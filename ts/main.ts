// @ts-nocheck
// ══════════════════════════════════════════════
// UI UTILITIES
// ══════════════════════════════════════════════
function toast(msg, type='info', ms=3000) {
  const el=document.getElementById('toast');
  if(!el) return;
  el.textContent=msg; el.className=`toast show ${type}`;
  setTimeout(()=>el.className='toast',ms);
}
function togglePw() {
  const i=document.getElementById('api-key');
  if(!i) return;
  i.type=i.type==='password'?'text':'password';
}

// ══════════════════════════════════════════════
// PROGRESS LOG
// ══════════════════════════════════════════════
function log(msg,type='info'){
  const el=document.getElementById('progress-log');
  if(!el) return;
  const t=new Date().toTimeString().slice(0,8);
  const d=document.createElement('div'); d.className='log-line';
  d.innerHTML=`<span class="log-time">${t}</span><span class="log-${type}">${msg}</span>`;
  el.appendChild(d); el.scrollTop=el.scrollHeight;
}
function setProgress(pct,label){
  const pf=document.getElementById('progress-fill');
  const ps=document.getElementById('progress-status');
  if(pf) pf.style.width=pct+'%';
  if(ps) ps.textContent=label;
}

// Wait for PROVIDERS to be defined
function waitForProviders() {
  return new Promise((resolve) => {
    if (typeof PROVIDERS !== 'undefined') {
      resolve();
    } else {
      const check = setInterval(() => {
        if (typeof PROVIDERS !== 'undefined') {
          clearInterval(check);
          resolve();
        }
      }, 100);
    }
  });
}

// ══════════════════════════════════════════════
// PROVIDER SELECTION
// ══════════════════════════════════════════════
function selectProvider(p) {
  curProvider = p;
  const P = PROVIDERS[p];
  document.querySelectorAll('.provider-pill').forEach(el => el.classList.toggle('active', el.dataset.p === p));
  if (P.url)   document.getElementById('api-url').value     = P.url;
  if (P.model) document.getElementById('model-input').value = P.model;
  document.getElementById('url-hint').textContent   = P.urlHint;
  document.getElementById('model-hint').textContent = P.modelHint;
  document.getElementById('api-key').placeholder    = P.keyPH;
  document.getElementById('conn-badge').style.display = 'none';
  updateRunInfo();
}

function getEndpointUrl() {
  const base = document.getElementById('api-url').value.trim().replace(/\/$/, '');
  return base + PROVIDERS[curProvider].endpoint;
}

// Extra headers
function addExtraHeader(k='', v='') {
  const idx = extraHeaders.length;
  extraHeaders.push({key:k, val:v});
  const list = document.getElementById('extra-headers');
  const row = document.createElement('div');
  row.className = 'header-row'; row.id = `eh-${idx}`;
  row.innerHTML = `<input type="text" placeholder="Header 名称" value="${k}" oninput="extraHeaders[${idx}].key=this.value">
    <input type="text" placeholder="值" value="${v}" oninput="extraHeaders[${idx}].val=this.value">
    <button class="btn btn-ghost" onclick="removeExtraHeader(${idx})">✕</button>`;
  list.appendChild(row);
}
function removeExtraHeader(idx) {
  extraHeaders.splice(idx, 1);
  document.getElementById('extra-headers').innerHTML = '';
  const copy = [...extraHeaders]; extraHeaders = [];
  copy.forEach(h => addExtraHeader(h.key, h.val));
}

// ══════════════════════════════════════════════
// BENCHMARK SELECTION
// ══════════════════════════════════════════════
function getBenchmarkSource() {
  const select = document.getElementById('benchmark-source');
  if (select && select.value !== 'generated') {
    const benchmarkName = select.value;
    const bm = benchmarks.find(b => b.name === benchmarkName);
    return bm || null;
  }
  return null;
}

// ══════════════════════════════════════════════
// MAIN EVAL FLOW
// ══════════════════════════════════════════════
async function startEval(){
  if(!getApiKey()||!getModel()){toast('请先完成 API 配置','error');return;}
  if(!uploadedFiles.length){toast('请上传 Skill 文件','error');return;}

  evalResults=[];compareAnalysis='';
  document.getElementById('progress-log').innerHTML='';
  document.getElementById('btn-run').disabled=true;
  document.getElementById('progress-wrap').classList.add('visible');
  document.getElementById('results-section').classList.remove('visible');

  // 检查是否使用 benchmark
  const benchmark = getBenchmarkSource();

  const skills=uploadedFiles.map(f=>parseSkillMd(f.name, f.content, { type: f.type, files: f.files, scripts: f.scripts }));
  const nE=getNEvals();
  const total=skills.length*(1+nE*2)+(doCompare()&&skills.length>1?1:0);
  let step=0;
  const advance=lbl=>{step++;setProgress(Math.round(step/total*100),lbl);};

  log(`开始评测 ${skills.length} 个 Skill，${nE} 用例/Skill  [${curProvider} · ${getModel()}]`,'info');
  if (benchmark) {
    log(`使用 Benchmark 数据集: ${benchmark.name} (${benchmark.test_cases?.length || 0} 个用例)`,'info');
  }

  for(const skill of skills){
    log(`▶ Skill: ${skill.name}`,'info');
    let evalsData;
    try{
      if (benchmark && benchmark.test_cases?.length > 0) {
        // 使用 benchmark 数据
        log(`  使用 Benchmark 测试用例...`);
        evalsData = { evals: benchmark.test_cases.slice(0, nE) };
      } else {
        // 生成测试用例
        log(`  生成测试用例...`);
        evalsData=await generateEvals(skill,nE);
      }
      advance(`${skill.name}: 生成用例`);
      log(`  ✅ ${benchmark ? '使用' : '生成'} ${evalsData.evals?.length||0} 个用例`,'ok');
    }catch(e){
      log(`  ❌ 生成失败: ${e.message}`,'err');
      step+=nE*2;setProgress(Math.round(step/total*100),`${skill.name}: 跳过`);
      evalResults.push({skill_name:skill.name,skill_path:skill.name,description:skill.description,eval_count:0,score:computeScore([]),gradings:[],evals:[],error:e.message,timestamp:new Date().toISOString(),provider:curProvider,model:getModel()});
      continue;
    }
    const cases=evalsData.evals||[];
    const gradings=[];
    for(let i=0;i<cases.length;i++){
      const c=cases[i];
      log(`  用例 ${i+1}/${cases.length}: ${c.prompt?.slice(0,50) || '用例'+(i+1)}...`);
      try{
        const ex=await executeEval(skill,c);
        log(`    执行 ${ex.duration}s / ${ex.output_chars} chars / ${formatCost(ex.cost_usd)}`,'ok');
        advance(`${skill.name} #${i+1} 执行`);
        const g=await gradeEval(skill,c,ex);
        log(`    通过率 ${((g.summary?.pass_rate??0)*100).toFixed(0)}%`,'ok');
        advance(`${skill.name} #${i+1} 评分`);
        gradings.push(g);
      }catch(e){
        log(`    ❌ ${e.message}`,'err');
        advance(`#${i+1} 执行`);advance(`#${i+1} 评分`);
        gradings.push({eval_id:c.id,error:e.message,summary:{passed:0,failed:0,total:0,pass_rate:0},dimension_scores:Object.fromEntries(Object.keys(DIM_W).map(k=>[k,0]))});
      }
    }
    const sc=computeScore(gradings);
    log(`✅ ${skill.name}  ${sc.total_score}/10  [${sc.grade}]  💰${formatCost(sc.total_cost_usd)}`,'ok');
    evalResults.push({skill_name:skill.name,skill_path:skill.name,description:skill.description,eval_count:cases.length,score:sc,gradings,evals:cases,timestamp:new Date().toISOString(),provider:curProvider,model:getModel(),benchmark:benchmark?.name});
  }

  if(doCompare()&&skills.length>=2){
    log('🔍 生成横向对比分析...','info');
    try{compareAnalysis=await compareAll(evalResults);log('✅ 对比完成','ok');}
    catch(e){log(`❌ 对比失败: ${e.message}`,'err');}
    advance('对比分析');
  }

  // 保存到回归测试历史
  saveRegressionHistory();

  setProgress(100,'评测完成 ✅');
  document.getElementById('progress-status').classList.remove('pulsing');
  log('🎉 全部完成！','ok');
  renderResults();
  document.getElementById('btn-run').disabled=false;
}

// ══════════════════════════════════════════════
// REGRESSION TEST
// ══════════════════════════════════════════════
function saveRegressionHistory() {
  const history = JSON.parse(localStorage.getItem('skill_eval_history') || '[]');

  for (const r of evalResults) {
    history.push({
      timestamp: new Date().toISOString(),
      skill_name: r.skill_name,
      score: r.score.total_score,
      grade: r.score.grade,
      avg_pass_rate: r.score.avg_pass_rate,
      provider: r.provider,
      model: r.model,
      cost_usd: r.score.total_cost_usd,
      benchmark: r.benchmark || null
    });
  }

  // 保留最近 100 条记录
  const trimmed = history.slice(-100);
  localStorage.setItem('skill_eval_history', JSON.stringify(trimmed));
}

function getRegressionHistory(skillName = null) {
  const history = JSON.parse(localStorage.getItem('skill_eval_history') || '[]');
  if (skillName) {
    return history.filter(h => h.skill_name === skillName);
  }
  return history;
}

function renderRegressionHistory() {
  const history = getRegressionHistory();
  const container = document.getElementById('regression-history');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = '<p style="color:var(--text3);font-size:12px">暂无历史记录</p>';
    return;
  }

  // 按技能分组显示最新 5 条
  const latestBySkill = {};
  for (const h of history.reverse()) {
    if (!latestBySkill[h.skill_name]) {
      latestBySkill[h.skill_name] = h;
    }
  }

  container.innerHTML = Object.values(latestBySkill).slice(0, 5).map(h => `
    <div class="file-item" style="background:var(--surface3);font-size:12px;">
      <span style="color:var(--text2)">${h.skill_name}</span>
      <span class="score-grade" style="background:${GC[h.grade]||'#444'}22">${h.grade}</span>
      <span style="color:var(--success)">${h.score}</span>
      <span style="color:var(--text3)">${h.timestamp?.slice(0, 10) || ''}</span>
    </div>
  `).join('');
}

function clearRegressionHistory() {
  localStorage.removeItem('skill_eval_history');
  renderRegressionHistory();
  toast('历史记录已清除','info');
}

// ══════════════════════════════════════════════
// REGRESSION MODE TOGGLE
// ══════════════════════════════════════════════
function setupRegressionToggle() {
  const modeSelect = document.getElementById('regression-mode');
  const intervalContainer = document.getElementById('regression-interval-container');

  if (modeSelect && intervalContainer) {
    modeSelect.addEventListener('change', () => {
      intervalContainer.style.display = modeSelect.value === 'auto' ? 'block' : 'none';
    });
  }

  // Show regression section
  const section = document.getElementById('regression-section');
  if (section) {
    section.style.display = 'block';
  }
}

// Run regression test
async function runRegressionTest() {
  if (!getApiKey() || !getModel()) {
    toast('请先完成 API 配置', 'error');
    return;
  }

  const history = getRegressionHistory();
  if (history.length === 0) {
    toast('暂无历史记录可回归测试', 'info');
    return;
  }

  // Get unique skill names from history
  const uniqueSkills = [...new Set(history.map(h => h.skill_name))];

  toast(`开始回归测试: ${uniqueSkills.length} 个Skill`, 'info');

  // For now, just run a normal evaluation
  // In a full implementation, this would reload the skill files and re-run
  toast('回归测试需要重新上传Skill文件', 'info');
}

// Add setup call at the end of waitForProviders
waitForProviders().then(() => {
  selectProvider('anthropic');
  renderRegressionHistory();
  setupRegressionToggle();
});