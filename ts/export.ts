// @ts-nocheck
// ══════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════
function dl(content,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();}
function exportJSON(){dl(JSON.stringify({generated_at:new Date().toISOString(),provider:curProvider,model:getModel(),api_url:document.getElementById('api-url').value,skills_evaluated:evalResults.length,compare_analysis:compareAnalysis,results:evalResults},null,2),`skill_eval_${Date.now()}.json`,'application/json');toast('JSON 已下载','success');}
function exportHTML(){dl(document.documentElement.outerHTML,`skill_eval_report_${Date.now()}.html`,'text/html');toast('HTML 已下载','success');}