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