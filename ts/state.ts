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

// Benchmark data
let benchmarks = []; // { name, version, test_cases: [], file }
let selectedBenchmark = null; // { name }

// Version tracking for A/B testing
let skillVersions = {}; // { 'skill-name': [ { version: 'v1', file: {...} }, ... ] }

// Regression test history
let regressionHistory = []; // { timestamp, skill_name, score, grade, provider, model }

// Chain evaluation config
let chainConfig = null; // { steps: [{ skill: 'xxx', action: '...' }] }

// Optimization suggestions cache
let optimizationCache = {}; // { skill_name: { suggestions, timestamp } }