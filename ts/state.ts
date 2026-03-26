// @ts-nocheck
// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let curProvider = 'anthropic';
let extraHeaders = [];  // [{key, val}]
let uploadedFiles = [];
let evalResults = [];
let compareAnalysis = '';
let radarChart = null;
let barChart = null;