"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistory = getHistory;
exports.saveToHistory = saveToHistory;
exports.clearHistory = clearHistory;
exports.deleteFromHistory = deleteFromHistory;
const vscode = require("vscode");
// -------------------- History helpers --------------------
const HISTORY_KEY = 'insertseq.history';
const HISTORY_MAX = Number(vscode.workspace.getConfiguration('insertseq.history').get('maxItems')) || 100;
function getHistory(ctx) {
    return ctx.globalState.get(HISTORY_KEY, []) || [];
}
async function saveToHistory(ctx, command) {
    if (command == null)
        return;
    // ensure non-empty command
    if (command === '')
        command = '1';
    const raw = getHistory(ctx);
    const filtered = raw.filter((e) => e !== command);
    filtered.unshift(command);
    if (filtered.length > HISTORY_MAX)
        filtered.length = HISTORY_MAX;
    await ctx.globalState.update(HISTORY_KEY, filtered);
}
async function clearHistory(ctx) {
    await ctx.globalState.update(HISTORY_KEY, []);
}
async function deleteFromHistory(ctx, item) {
    if (!item)
        return;
    const list = getHistory(ctx).filter((x) => x !== item);
    await ctx.globalState.update(HISTORY_KEY, list);
}
//# sourceMappingURL=history.js.map