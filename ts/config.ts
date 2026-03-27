// @ts-nocheck
// ══════════════════════════════════════════════
// PROVIDER PRESETS
// ══════════════════════════════════════════════
const PROVIDERS = {
  anthropic:   { url:'https://api.anthropic.com',             model:'claude-sonnet-4-20250514',          fmt:'anthropic', endpoint:'/v1/messages',                    urlHint:'Anthropic Messages API',                           modelHint:'claude-sonnet-4-20250514 / claude-haiku-4-5-20251001', keyPH:'sk-ant-api03-...' },
  openai:      { url:'https://api.openai.com',                model:'gpt-4o',                            fmt:'openai',    endpoint:'/v1/chat/completions',             urlHint:'OpenAI Chat Completions',                          modelHint:'gpt-4o / gpt-4o-mini / gpt-4-turbo',                  keyPH:'sk-...' },
  deepseek:    { url:'https://api.deepseek.com',              model:'deepseek-chat',                     fmt:'openai',    endpoint:'/v1/chat/completions',             urlHint:'DeepSeek Chat Completions',                        modelHint:'deepseek-chat / deepseek-reasoner',                    keyPH:'sk-...' },
  siliconflow: { url:'https://api.siliconflow.cn',            model:'Qwen/Qwen2.5-72B-Instruct',         fmt:'openai',    endpoint:'/v1/chat/completions',             urlHint:'硅基流动 SiliconFlow',                             modelHint:'Qwen/Qwen2.5-72B-Instruct / deepseek-ai/DeepSeek-V3', keyPH:'sk-...' },
  zhipu:       { url:'https://open.bigmodel.cn',              model:'glm-4-plus',                        fmt:'openai',    endpoint:'/api/paas/v4/chat/completions',    urlHint:'智谱 AI BigModel',                                 modelHint:'glm-4-plus / glm-4-flash / glm-4-air',                keyPH:'你的 API Key' },
  moonshot:    { url:'https://api.moonshot.cn',               model:'moonshot-v1-8k',                    fmt:'openai',    endpoint:'/v1/chat/completions',             urlHint:'Moonshot Kimi',                                    modelHint:'moonshot-v1-8k / moonshot-v1-32k / moonshot-v1-128k',  keyPH:'sk-...' },
  ollama:      { url:'http://localhost:11434',                 model:'llama3.1',                          fmt:'openai',    endpoint:'/v1/chat/completions',             urlHint:'Ollama 本地 (需启用 CORS: OLLAMA_ORIGINS=*)',      modelHint:'llama3.1 / qwen2.5 / gemma3 (本地已安装)',            keyPH:'ollama' },
  custom:      { url:'http://10.197.2.131:3003/api',          model:'claude-sonnet-4-6',                 fmt:'anthropic',    endpoint:'/v1/messages',             urlHint:'完整 Base URL，不含路径',                          modelHint:'模型名称',                                             keyPH:'Your API Key' }
};

// ══════════════════════════════════════════════
// DIMENSION CONFIG
// ══════════════════════════════════════════════
const DIM_W = { trigger_accuracy:.20, output_quality:.35, instruction_follow:.20, robustness:.15, efficiency:.10 };
const DIM_CN = { trigger_accuracy:'触发准确', output_quality:'输出质量', instruction_follow:'指令遵循', robustness:'鲁棒性', efficiency:'效率' };

// ══════════════════════════════════════════════
// CHART COLORS
// ══════════════════════════════════════════════
const GC = { S:'#7c3aed', A:'#2563eb', B:'#16a34a', C:'#d97706', D:'#dc2626', F:'#4b5563' };
const PAL = ['#7c6aff', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];
const SC = s => s>=8?'var(--success)':s>=6?'var(--warning)':'var(--danger)';

// ══════════════════════════════════════════════
// COST CONFIG (per 1M tokens, USD)
// ══════════════════════════════════════════════
const COST_PER_MILLION = {
  // Anthropic models
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  // OpenAI models
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  // SiliconFlow (Qwen, etc.)
  'Qwen/Qwen2.5-72B-Instruct': { input: 0.40, output: 0.40 },
  'deepseek-ai/DeepSeek-V3': { input: 0.07, output: 0.70 },
  // Zhipu
  'glm-4-plus': { input: 1.00, output: 1.00 },
  'glm-4-flash': { input: 0.00, output: 0.00 },
  'glm-4-air': { input: 0.00, output: 0.00 },
  // Moonshot
  'moonshot-v1-8k': { input: 12.00, output: 12.00 },
  // Ollama (free, no cost)
  'llama3.1': { input: 0, output: 0 },
  'qwen2.5': { input: 0, output: 0 },
  // Default fallback
  'default': { input: 1.00, output: 3.00 }
};

function getCostPerModel(model) {
  // Exact match
  if (COST_PER_MILLION[model]) return COST_PER_MILLION[model];
  // Partial match for unknown models
  const modelLower = model.toLowerCase();
  if (modelLower.includes('claude')) return COST_PER_MILLION['claude-sonnet-4-20250514'];
  if (modelLower.includes('gpt-4o-mini') || modelLower.includes('mini')) return COST_PER_MILLION['gpt-4o-mini'];
  if (modelLower.includes('gpt-4o')) return COST_PER_MILLION['gpt-4o'];
  if (modelLower.includes('deepseek')) return COST_PER_MILLION['deepseek-chat'];
  if (modelLower.includes('qwen')) return COST_PER_MILLION['Qwen/Qwen2.5-72B-Instruct'];
  if (modelLower.includes('glm')) return COST_PER_MILLION['glm-4-plus'];
  if (modelLower.includes('llama') || modelLower.includes('ollama')) return COST_PER_MILLION['llama3.1'];
  return COST_PER_MILLION['default'];
}

function calculateCost(usage, model) {
  const rates = getCostPerModel(model);
  return (usage.input_tokens / 1e6 * rates.input) + (usage.output_tokens / 1e6 * rates.output);
}