// @ts-nocheck
// ══════════════════════════════════════════════
// SKILL PARSING
// ══════════════════════════════════════════════
function parseSkillMd(filename, content, fileInfo = null) {
  const sk = {
    name: filename.replace(/\.md$|\.skill$/, '').replace(/_[\w]+$/, ''), // 移除随机后缀
    description: '',
    body: content,
    type: fileInfo?.type || 'single',
    files: fileInfo?.files || null,
    scripts: fileInfo?.scripts || {}
  };

  // 解析 frontmatter
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm) {
    for (const l of fm[1].split('\n')) {
      if (l.startsWith('name:')) sk.name = l.split(':')[1].trim().replace(/['"]/g, '');
      if (l.startsWith('description:')) sk.description = l.split(':').slice(1).join(':').trim().replace(/['"]/g, '');
    }
  }

  return sk;
}

// ══════════════════════════════════════════════
// COST & USAGE TRACKING
// ══════════════════════════════════════════════
function addUsage(accumulator, newUsage) {
  return {
    input_tokens: (accumulator.input_tokens || 0) + (newUsage.input_tokens || 0),
    output_tokens: (accumulator.output_tokens || 0) + (newUsage.output_tokens || 0),
    total_tokens: (accumulator.total_tokens || 0) + (newUsage.total_tokens || 0)
  };
}

function formatCost(cost) {
  if (cost < 0.01) return `$${(cost * 1000).toFixed(2)}m`;
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens) {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

// ══════════════════════════════════════════════
// EVAL PIPELINE
// ══════════════════════════════════════════════
async function generateEvals(skill, n) {
  let skillIntro = `## Skill 内容\n${skill.body.slice(0, 5000)}`;

  // 如果有多个文件，提供文件列表信息
  if (skill.files && skill.files.length > 1) {
    const fileNames = skill.files.map(f => f.name).join(', ');
    skillIntro += `\n\n## Skill 包包含以下文件:\n${fileNames}`;
  }

  // 如果有 scripts，提供脚本信息
  if (skill.scripts && Object.keys(skill.scripts).length > 0) {
    const scriptNames = Object.keys(skill.scripts).join(', ');
    skillIntro += `\n\n## 可用脚本:\n${scriptNames}`;
  }

  const p = `你是一个 Skill 评测专家。根据以下 Skill 内容，生成 ${n} 个多样化的测试用例。

${skillIntro}

## 要求
覆盖：典型场景、边缘情况、异常处理、不同复杂度。

## 输出格式
严格输出 JSON，无任何代码块包裹：
{"skill_name":"xxx","evals":[{"id":1,"prompt":"用户请求","expected_output":"预期描述","expectations":["期望1","期望2","期望3"],"difficulty":"easy|medium|hard","category":"典型场景|边缘情况|异常处理"}]}`;
  const result = await callApi([{ role: 'user', content: p }]);
  return parseJson(result.content);
}

async function executeEval(skill, c) {
  let skillContext = `## 你拥有的 Skill\n${skill.body.slice(0, 4500)}`;

  // 如果有多个文件，说明文件结构
  if (skill.files && skill.files.length > 1) {
    const fileNames = skill.files.map(f => f.name).join(', ');
    skillContext += `\n\n## Skill 包包含以下文件:\n${fileNames}`;
  }

  // 如果有 scripts，提供脚本内容
  if (skill.scripts && Object.keys(skill.scripts).length > 0) {
    skillContext += `\n\n## 可用脚本:\n`;
    for (const [name, content] of Object.entries(skill.scripts)) {
      skillContext += `\n### ${name}\n\`\`\`\n${content.slice(0, 1000)}\n\`\`\`\n`;
    }
  }

  const p = `你是一个严格按照 Skill 指令工作的 AI 助手。

${skillContext}

## 任务
请按照上面 Skill 的指引，完成以下用户请求，展示工作过程：

${c.prompt}`;

  const t0 = Date.now();
  const result = await callApi([{ role: 'user', content: p }]);
  const out = result.content;
  const usage = result.usage;
  const model = getModel();
  const cost = calculateCost(usage, model);

  return {
    output: out,
    duration: ((Date.now() - t0) / 1000).toFixed(2),
    output_chars: out.length,
    usage: usage,
    cost_usd: cost
  };
}

async function gradeEval(skill, c, exec) {
  const exps = (c.expectations || []).map((e, i) => `${i + 1}. ${e}`).join('\n');

  let skillContext = `## Skill 内容\n${skill.body.slice(0, 3000)}`;

  // 如果是包，提供额外信息
  if (skill.files && skill.files.length > 1) {
    skillContext += `\n\n(该 Skill 来自包，包含 ${skill.files.length} 个文件)`;
  }

  const p = `你是严格的 Skill 评测评审官。

## 评测维度（各给0-10分）
- trigger_accuracy（触发准确性）
- output_quality（输出质量）
- instruction_follow（指令遵循度）
- robustness（鲁棒性）
- efficiency（效率）

${skillContext}

## 测试用例
请求：${c.prompt}
预期：${c.expected_output || '（未指定）'}
具体期望：
${exps || '（未指定）'}

## 实际输出
${exec.output.slice(0, 3000)}

严格输出 JSON，无代码块包裹：
{"expectations":[{"text":"期望","passed":true,"evidence":"证据"}],"summary":{"passed":2,"failed":1,"total":3,"pass_rate":0.67},"dimension_scores":{"trigger_accuracy":8,"output_quality":7,"instruction_follow":9,"robustness":6,"efficiency":8},"strengths":["优点"],"weaknesses":["不足"],"improvement_suggestions":["建议"],"overall_comment":"综合评价"}`;

  const result = await callApi([{ role: 'user', content: p }]);
  const g = parseJson(result.content);
  g.eval_id = c.id;
  g.duration_seconds = parseFloat(exec.duration);
  g.output_chars = exec.output_chars;
  // Add cost tracking from execution
  g.usage = exec.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  g.cost_usd = exec.cost_usd || 0;
  // Add grading API call usage
  const model = getModel();
  g.grading_usage = result.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  g.grading_cost = calculateCost(result.usage || { input_tokens: 0, output_tokens: 0 }, model);
  return g;
}

function computeScore(gs) {
  if (!gs.length) return { total_score: 0, grade: 'N/A', avg_pass_rate: 0, dimensions: {}, eval_count: 0, total_duration_seconds: 0, total_cost_usd: 0, total_tokens: 0 };

  const dims = {};
  Object.keys(DIM_W).forEach(d => dims[d] = []);
  const prs = [];
  let dur = 0;
  let cost = 0;
  let totalTokens = { input: 0, output: 0, total: 0 };

  for (const g of gs) {
    const ds = g.dimension_scores || {};
    Object.keys(DIM_W).forEach(d => { if (ds[d] != null) dims[d].push(+ds[d]); });
    if (g.summary?.pass_rate != null) prs.push(+g.summary.pass_rate);
    dur += g.duration_seconds || 0;
    cost += (g.cost_usd || 0) + (g.grading_cost || 0);

    // Aggregate usage
    if (g.usage) {
      totalTokens.input += g.usage.input_tokens || 0;
      totalTokens.output += g.usage.output_tokens || 0;
      totalTokens.total += g.usage.total_tokens || 0;
    }
    if (g.grading_usage) {
      totalTokens.input += g.grading_usage.input_tokens || 0;
      totalTokens.output += g.grading_usage.output_tokens || 0;
      totalTokens.total += g.grading_usage.total_tokens || 0;
    }
  }

  const avg = {};
  Object.keys(dims).forEach(d => { avg[d] = dims[d].length ? +(dims[d].reduce((a, b) => a + b) / dims[d].length).toFixed(2) : 0; });
  const tot = +Object.entries(DIM_W).reduce((s, [d, w]) => s + avg[d] * w, 0).toFixed(2);
  return {
    total_score: tot,
    grade: tot >= 9 ? 'S' : tot >= 8 ? 'A' : tot >= 7 ? 'B' : tot >= 6 ? 'C' : tot >= 5 ? 'D' : 'F',
    avg_pass_rate: prs.length ? +(prs.reduce((a, b) => a + b) / prs.length).toFixed(3) : 0,
    dimensions: avg,
    total_duration_seconds: +dur.toFixed(2),
    eval_count: gs.length,
    total_cost_usd: +cost.toFixed(4),
    total_tokens: totalTokens
  };
}

// ══════════════════════════════════════════════
// STABILITY EVALUATION
// ══════════════════════════════════════════════
async function runStabilityEval(skill, testCase, nRuns = 3) {
  const results = [];
  const gradings = [];

  log(`  稳定性测试: 执行 ${nRuns} 次...`, 'info');

  for (let i = 0; i < nRuns; i++) {
    try {
      const exec = await executeEval(skill, testCase);
      const grading = await gradeEval(skill, testCase, exec);
      results.push({ exec, grading });
      gradings.push(grading);
      log(`    第 ${i + 1}/${nRuns} 次: 得分 ${grading.summary?.pass_rate || 0}`, 'ok');
    } catch (e) {
      log(`    第 ${i + 1}/${nRuns} 次失败: ${e.message}`, 'err');
    }
  }

  // Calculate stability metrics
  const scores = gradings.map(g => g.summary?.pass_rate || 0);
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const variance = scores.length ? scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length : 0;
  const stdDev = Math.sqrt(variance);
  const variancePct = mean > 0 ? (stdDev / mean * 100) : 0;

  const stability = {
    mean_score: mean,
    std_dev: stdDev,
    variance_pct: variancePct,
    stability_rating: variancePct <= 10 ? '高' : variancePct <= 25 ? '中' : '低',
    runs: nRuns,
    scores: scores
  };

  log(`  稳定性: ${stability.stability_rating} (方差 ${variancePct.toFixed(1)}%)`, 'info');

  return { results, gradings, stability };
}

async function compareAll(results) {
  const summary = results.map(r => ({
    skill: r.skill_name,
    score: r.score.total_score,
    grade: r.score.grade,
    pass_rate: r.score.avg_pass_rate,
    dimensions: r.score.dimensions,
    cost_usd: r.score.total_cost_usd,
    total_tokens: r.score.total_tokens?.total || 0
  }));
  const result = await callApi([{
    role: 'user',
    content: `你是 Skill 质量分析专家，对以下多个 Skill 评测结果进行横向对比分析。

${JSON.stringify(summary, null, 2)}

请输出中文分析（约300-500字），包括：1.各Skill排名及理由 2.每个Skill核心优势与不足 3.共性问题 4.改进建议 5.成本效益分析`
  }]);
  return result.content;
}

// ══════════════════════════════════════════════
// OPTIMIZATION SUGGESTIONS
// ══════════════════════════════════════════════
async function generateOptimizationSuggestions(result) {
  const skillName = result.skill_name;
  const dims = result.score.dimensions;
  const gradings = result.gradings || [];

  // 收集低分维度和具体问题
  const lowDims = Object.entries(dims)
    .filter(([_, v]) => v < 7)
    .map(([k, v]) => `${DIM_CN[k] || k}: ${v}/10`)
    .join(', ');

  // 收集所有不足和建议
  const allWeaknesses = [];
  const allSuggestions = [];

  for (const g of gradings) {
    if (g.weaknesses) allWeaknesses.push(...g.weaknesses);
    if (g.improvement_suggestions) allSuggestions.push(...g.improvement_suggestions);
  }

  const prompt = `你是 Skill 优化专家。基于以下评测结果，为 Skill "${skillName}" 生成优化建议。

## 评测结果摘要
- 总分: ${result.score.total_score}/10 (${result.score.grade})
- 通过率: ${(result.score.avg_pass_rate * 100).toFixed(0)}%
- 低分维度: ${lowDims || '无明显低分维度'}

## 具体问题（来自评审）
${allWeaknesses.slice(0, 5).map((w, i) => `${i + 1}. ${w}`).join('\n')}

## 现有建议
${allSuggestions.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join('\n')}

请输出 JSON 格式的优化建议：
{"improvements":[{"area":"改进领域","suggestion":"具体建议","priority":"high|medium|low","example":"示例"}],"summary":"总体优化方向（100字内）"}`;

  try {
    const apiResult = await callApi([{ role: 'user', content: prompt }]);
    const suggestions = parseJson(apiResult.content);

    // 缓存建议
    optimizationCache[skillName] = {
      suggestions,
      timestamp: new Date().toISOString()
    };

    return suggestions;
  } catch (e) {
    console.error('生成优化建议失败:', e);
    return null;
  }
}

function getOptimizationSuggestions(skillName) {
  return optimizationCache[skillName] || null;
}

// ══════════════════════════════════════════════
// SKILL CHAIN EVALUATION
// ══════════════════════════════════════════════
async function executeChainEval(chainSteps, testCase) {
  const results = [];
  let context = testCase.prompt;

  for (let i = 0; i < chainSteps.length; i++) {
    const step = chainSteps[i];
    const skill = step.skill;

    log(`  链路步骤 ${i + 1}/${chainSteps.length}: ${skill.name}`, 'info');

    // Create a test case with current context
    const stepCase = {
      id: testCase.id,
      prompt: context,
      expected_output: step.expected_output || '',
      expectations: step.expectations || []
    };

    try {
      const exec = await executeEval(skill, stepCase);
      const grading = await gradeEval(skill, stepCase, exec);

      results.push({
        step: i + 1,
        skill_name: skill.name,
        execution: exec,
        grading: grading,
        success: grading.summary?.pass_rate > 0.5
      });

      // Update context for next step (use output as next input)
      context = exec.output;

      log(`    ✓ 步骤完成，通过率 ${((grading.summary?.pass_rate || 0) * 100).toFixed(0)}%`, 'ok');
    } catch (e) {
      log(`    ✗ 步骤失败: ${e.message}`, 'err');
      results.push({
        step: i + 1,
        skill_name: skill.name,
        error: e.message,
        success: false
      });
      break; // Stop chain on error
    }
  }

  return results;
}

function computeChainScore(chainResults) {
  const totalSteps = chainResults.length;
  const successfulSteps = chainResults.filter(r => r.success).length;
  const successRate = totalSteps > 0 ? successfulSteps / totalSteps : 0;

  // Calculate average score across all steps
  const scores = chainResults
    .filter(r => r.grading)
    .map(r => r.grading.summary?.pass_rate || 0);

  const avgScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  return {
    total_steps: totalSteps,
    successful_steps: successfulSteps,
    success_rate: successRate,
    avg_score: avgScore,
    chain_grade: successRate >= 0.9 ? 'S' : successRate >= 0.7 ? 'A' : successRate >= 0.5 ? 'B' : 'C',
    is_complete: chainResults.every(r => !r.error)
  };
}