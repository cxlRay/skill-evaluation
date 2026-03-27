// @ts-nocheck
// ══════════════════════════════════════════════
// UNIVERSAL API CALLER
// Anthropic Messages API  +  OpenAI Chat Completions (compatible)
// Returns: { content: string, usage: { input_tokens, output_tokens, total_tokens } }
// ══════════════════════════════════════════════
async function callApi(messages, systemPrompt='') {
  const P   = PROVIDERS[curProvider];
  const fmt = P.fmt;
  const url = getEndpointUrl();
  const key = getApiKey();
  const mdl = getModel();
  const tok = getMaxTokens();

  let body, headers;

  if (fmt === 'anthropic') {
    // ── Anthropic native format ──
    body = { model:mdl, max_tokens:tok, messages };
    if (systemPrompt) body.system = systemPrompt;
    headers = {
      'Content-Type':'application/json',
      'x-api-key':key,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true',
    };
  } else {
    // ── OpenAI-compatible format (works with DeepSeek, Qwen, GLM, Kimi, Ollama …) ──
    const msgs = systemPrompt ? [{role:'system',content:systemPrompt},...messages] : messages;
    body = { model:mdl, max_tokens:tok, messages:msgs };
    headers = {
      'Content-Type':'application/json',
      'Authorization':`Bearer ${key}`,
    };
  }

  // Merge user-defined extra headers
  for (const h of extraHeaders) {
    if (h.key.trim()) headers[h.key.trim()] = h.val;
  }

  const resp = await fetch(url, { method:'POST', headers, body:JSON.stringify(body) });
  if (!resp.ok) {
    const err = await resp.json().catch(()=>({}));
    throw new Error(err?.error?.message || err?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();

  // Parse response and extract usage
  let content = '';
  let usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

  if (fmt === 'anthropic') {
    content = (data.content||[]).map(b=>b.type==='text'?b.text:'').join('');
    // Anthropic usage format
    usage = {
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    };
  } else {
    content = data.choices?.[0]?.message?.content || '';
    // OpenAI-compatible usage format
    usage = {
      input_tokens: data.usage?.prompt_tokens || data.usage?.input_tokens || 0,
      output_tokens: data.usage?.completion_tokens || data.usage?.output_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0
    };
  }

  return { content, usage };
}

// Simple wrapper for backward compatibility - returns just the content
async function callApiContent(messages, systemPrompt='') {
  const result = await callApi(messages, systemPrompt);
  return result.content;
}

function parseJson(text) {
  const c=text.replace(/```(?:json)?\s*/g,'').replace(/```\s*$/g,'').trim();
  try{return JSON.parse(c);}catch{
    const m=c.match(/\{[\s\S]*\}/);
    if(m) return JSON.parse(m[0]);
    throw new Error('JSON 解析失败');
  }
}

// ══════════════════════════════════════════════
// TEST CONNECTION
// ══════════════════════════════════════════════
async function testConnection() {
  const btn=document.getElementById('btn-test');
  const badge=document.getElementById('conn-badge');
  const dot=document.getElementById('conn-dot');
  const txt=document.getElementById('conn-text');
  badge.style.display='inline-flex'; badge.className='status-badge checking';
  dot.textContent='●'; txt.textContent='连接中...';
  btn.disabled=true; btn.textContent='验证中...';
  try {
    const result = await callApi([{role:'user',content:'Reply with just: OK'}]);
    badge.className='status-badge ok';
    txt.textContent=`连接成功 · ${curProvider} · ${getModel()}`;
    toast('连接成功','success'); updateRunInfo();
  } catch(e) {
    badge.className='status-badge err';
    txt.textContent=`失败: ${e.message.slice(0,55)}`;
    toast('连接失败: '+e.message.slice(0,50),'error');
  }
  btn.disabled=false; btn.textContent='验证连接';
}