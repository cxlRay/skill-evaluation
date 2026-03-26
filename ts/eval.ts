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
  return parseJson(await callApi([{ role: 'user', content: p }]));
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
  const out = await callApi([{ role: 'user', content: p }]);
  return { output: out, duration: ((Date.now() - t0) / 1000).toFixed(2), output_chars: out.length };
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

  const g = parseJson(await callApi([{ role: 'user', content: p }]));
  g.eval_id = c.id;
  g.duration_seconds = parseFloat(exec.duration);
  g.output_chars = exec.output_chars;
  return g;
}

function computeScore(gs) {
  if (!gs.length) return { total_score: 0, grade: 'N/A', avg_pass_rate: 0, dimensions: {}, eval_count: 0, total_duration_seconds: 0 };
  const dims = {};
  Object.keys(DIM_W).forEach(d => dims[d] = []);
  const prs = [];
  let dur = 0;
  for (const g of gs) {
    const ds = g.dimension_scores || {};
    Object.keys(DIM_W).forEach(d => { if (ds[d] != null) dims[d].push(+ds[d]); });
    if (g.summary?.pass_rate != null) prs.push(+g.summary.pass_rate);
    dur += g.duration_seconds || 0;
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
    eval_count: gs.length
  };
}

async function compareAll(results) {
  const summary = results.map(r => ({
    skill: r.skill_name,
    score: r.score.total_score,
    grade: r.score.grade,
    pass_rate: r.score.avg_pass_rate,
    dimensions: r.score.dimensions
  }));
  return callApi([{
    role: 'user',
    content: `你是 Skill 质量分析专家，对以下多个 Skill 评测结果进行横向对比分析。

${JSON.stringify(summary, null, 2)}

请输出中文分析（约300-500字），包括：1.各Skill排名及理由 2.每个Skill核心优势与不足 3.共性问题 4.改进建议`
  }]);
}