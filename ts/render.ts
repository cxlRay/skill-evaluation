// @ts-nocheck
// ══════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════
function renderResults(){
  document.getElementById('results-section').classList.add('visible');
  const sorted=[...evalResults].sort((a,b)=>b.score.total_score-a.score.total_score);
  document.getElementById('score-grid').innerHTML=sorted.map((r,i)=>`
    <div class="score-card ${i===0?'active':''}" onclick="showDetail('${r.skill_name}')">
      <div class="score-num" style="color:${SC(r.score.total_score)}">${r.score.total_score}</div>
      <div class="score-grade" style="background:${GC[r.score.grade]||'#4b5563'}22;color:${GC[r.score.grade]||'#94a3b8'}">${r.score.grade}</div>
      <div class="score-name">${r.skill_name}</div>
      <div class="score-sub">通过率 ${(r.score.avg_pass_rate*100).toFixed(0)}% · ${r.score.eval_count} 用例</div>
      <div style="font-size:10px;color:var(--text3);font-family:var(--font-mono);margin-top:3px">${r.provider||''} · ${r.model||''}</div>
    </div>`).join('');
  renderCharts(sorted);
  if(compareAnalysis){document.getElementById('compare-panel').classList.add('visible');document.getElementById('compare-text').textContent=compareAnalysis;}
  if(sorted.length) showDetail(sorted[0].skill_name);
  document.getElementById('results-section').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderCharts(sorted){
  const dims=Object.keys(DIM_W), labels=dims.map(d=>DIM_CN[d]);
  const rds=evalResults.map((r,i)=>({label:r.skill_name,data:dims.map(d=>r.score.dimensions[d]||0),borderColor:PAL[i%PAL.length],backgroundColor:PAL[i%PAL.length]+'28',pointBackgroundColor:PAL[i%PAL.length],borderWidth:2}));
  if(radarChart) radarChart.destroy();
  radarChart=new Chart(document.getElementById('radar-chart'),{
    type:'radar',data:{labels,datasets:rds},
    options:{responsive:true,maintainAspectRatio:true,
      scales:{r:{min:0,max:10,ticks:{stepSize:2,color:'#5a5a72',backdropColor:'transparent',font:{family:'JetBrains Mono',size:10}},grid:{color:'#2a2a3a'},angleLines:{color:'#2a2a3a'},pointLabels:{color:'#9090a8',font:{family:'Syne',size:11}}}},
      plugins:{legend:{labels:{color:'#9090a8',font:{family:'Syne',size:11}}}}}});
  if(barChart) barChart.destroy();
  barChart=new Chart(document.getElementById('bar-chart'),{
    type:'bar',
    data:{labels:sorted.map(r=>r.skill_name),datasets:[{label:'综合得分',data:sorted.map(r=>r.score.total_score),backgroundColor:sorted.map((_,i)=>PAL[i%PAL.length]+'aa'),borderColor:sorted.map((_,i)=>PAL[i%PAL.length]),borderWidth:2,borderRadius:8}]},
    options:{responsive:true,maintainAspectRatio:true,
      scales:{y:{min:0,max:10,ticks:{color:'#5a5a72',font:{family:'JetBrains Mono',size:10}},grid:{color:'#2a2a3a'}},x:{ticks:{color:'#9090a8',font:{family:'Syne',size:11}},grid:{display:false}}},
      plugins:{legend:{display:false}}}});
}

function showDetail(name){
  const r=evalResults.find(x=>x.skill_name===name); if(!r) return;
  document.querySelectorAll('.score-card').forEach(el=>el.classList.toggle('active',el.querySelector('.score-name')?.textContent===name));
  const sc=r.score;
  document.getElementById('detail-name').textContent=r.skill_name;
  document.getElementById('detail-meta').textContent=`${r.provider||''}  ·  ${r.model||''}  ·  ${r.skill_path}`;
  document.getElementById('detail-desc').textContent=r.description||'';
  document.getElementById('detail-score').textContent=sc.total_score+'/10';
  document.getElementById('detail-score').style.color=SC(sc.total_score);
  const dg=document.getElementById('detail-grade');
  dg.textContent=sc.grade;dg.style.background=(GC[sc.grade]||'#4b5563')+'22';dg.style.color=GC[sc.grade]||'#94a3b8';
  document.getElementById('detail-stats').textContent=`通过率 ${(sc.avg_pass_rate*100).toFixed(0)}%  ·  ${sc.eval_count} 用例  ·  ${sc.total_duration_seconds}s`;
  document.getElementById('dim-grid').innerHTML=Object.entries(sc.dimensions).map(([d,v])=>`
    <div class="dim-row">
      <div class="dim-label">${DIM_CN[d]||d}</div>
      <div class="dim-bar-wrap"><div class="dim-bar" style="width:${v/10*100}%;background:${SC(v)}"></div></div>
      <div class="dim-val" style="color:${SC(v)}">${v}</div>
    </div>`).join('');
  document.getElementById('eval-list').innerHTML=r.gradings.map((g,i)=>{
    const c=r.evals[i]||{};
    const pr=g.summary?.pass_rate??0;
    const tD=c.difficulty?`<span class="tag tag-${c.difficulty}">${c.difficulty}</span>`:'';
    const tR=`<span class="tag tag-${pr>=.7?'pass':'fail'}">${(pr*100).toFixed(0)}%</span>`;
    const exps=(g.expectations||[]).map(ex=>`
      <div class="expect-row ${ex.passed?'expect-pass':'expect-fail'}">
        <span>${ex.passed?'✅':'❌'}</span>
        <div class="expect-text"><div>${ex.text||''}</div><div class="expect-evidence">${ex.evidence||''}</div></div>
      </div>`).join('');
    const li=(arr,col)=>arr?.length?`<ul style="margin:6px 0 0 16px;font-size:12px">${arr.map(s=>`<li style="color:${col}">${s}</li>`).join('')}</ul>`:'' ;
    return `<div class="eval-item" id="ev-${i}">
      <div class="eval-header" onclick="document.getElementById('ev-${i}').classList.toggle('open')">
        <span class="eval-num">#${i+1}</span>
        <span class="eval-prompt">${c.prompt||'用例'+(i+1)}</span>
        <div class="eval-tags">${tD}${tR}</div>
        <span class="eval-chevron">▶</span>
      </div>
      <div class="eval-body">
        ${c.category?`<p style="font-size:12px;color:var(--text3);margin-bottom:10px">分类: ${c.category}</p>`:''}
        ${c.expected_output?`<p style="font-size:13px;color:var(--text2);margin-bottom:12px"><b>预期：</b>${c.expected_output}</p>`:''}
        <div class="expect-list">${exps||'<p style="color:var(--text3);font-size:12px">无期望数据</p>'}</div>
        ${g.strengths?.length?`<div style="margin-top:10px"><b style="font-size:12px">优点：</b>${li(g.strengths,'var(--success)')}</div>`:''}
        ${g.weaknesses?.length?`<div style="margin-top:8px"><b style="font-size:12px">不足：</b>${li(g.weaknesses,'var(--danger)')}</div>`:''}
        ${g.improvement_suggestions?.length?`<div style="margin-top:8px"><b style="font-size:12px">改进建议：</b>${li(g.improvement_suggestions,'var(--text2)')}</div>`:''}
        ${g.overall_comment?`<div class="feedback-box">${g.overall_comment}</div>`:''}
      </div>
    </div>`;
  }).join('')||'<p style="color:var(--text3);font-size:13px">暂无数据</p>';
  document.getElementById('detail-panel').classList.add('visible');
  document.getElementById('detail-panel').scrollIntoView({behavior:'smooth',block:'nearest'});
}