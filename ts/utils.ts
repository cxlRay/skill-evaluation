// @ts-nocheck
// ══════════════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════════════
function getApiKey() {
  return document.getElementById('api-key').value.trim();
}
function getModel() {
  return document.getElementById('model-input').value.trim();
}
function getNEvals() {
  return parseInt(document.getElementById('n-evals').value) || 4;
}
function doCompare() {
  return document.getElementById('do-compare').value === 'yes';
}
function getMaxTokens() {
  return parseInt(document.getElementById('max-tokens').value) || 32000;
}
function getStabilityRuns() {
  return parseInt(document.getElementById('stability-runs').value) || 0;
}