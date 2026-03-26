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

  const skills=uploadedFiles.map(f=>parseSkillMd(f.name, f.content, { type: f.type, files: f.files, scripts: f.scripts }));
  const nE=getNEvals();
  const total=skills.length*(1+nE*2)+(doCompare()&&skills.length>1?1:0);
  let step=0;
  const advance=lbl=>{step++;setProgress(Math.round(step/total*100),lbl);};

  log(`开始评测 ${skills.length} 个 Skill，${nE} 用例/Skill  [${curProvider} · ${getModel()}]`,'info');

  for(const skill of skills){
    log(`▶ Skill: ${skill.name}`,'info');
    let evalsData;
    try{
      log(`  生成测试用例...`);
      evalsData=await generateEvals(skill,nE);
      advance(`${skill.name}: 生成用例`);
      log(`  ✅ 生成 ${evalsData.evals?.length||0} 个用例`,'ok');
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
      log(`  用例 ${i+1}/${cases.length}: ${c.prompt.slice(0,50)}...`);
      try{
        const ex=await executeEval(skill,c);
        log(`    执行 ${ex.duration}s / ${ex.output_chars} chars`,'ok');
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
    log(`✅ ${skill.name}  ${sc.total_score}/10  [${sc.grade}]`,'ok');
    evalResults.push({skill_name:skill.name,skill_path:skill.name,description:skill.description,eval_count:cases.length,score:sc,gradings,evals:cases,timestamp:new Date().toISOString(),provider:curProvider,model:getModel()});
  }

  if(doCompare()&&skills.length>=2){
    log('🔍 生成横向对比分析...','info');
    try{compareAnalysis=await compareAll(evalResults);log('✅ 对比完成','ok');}
    catch(e){log(`❌ 对比失败: ${e.message}`,'err');}
    advance('对比分析');
  }

  setProgress(100,'评测完成 ✅');
  document.getElementById('progress-status').classList.remove('pulsing');
  log('🎉 全部完成！','ok');
  renderResults();
  document.getElementById('btn-run').disabled=false;
}

// Init - wait for all dependencies
waitForProviders().then(() => {
  selectProvider('anthropic');
});