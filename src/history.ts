import * as vscode from 'vscode';

// -------------------- History helpers --------------------
const HISTORY_KEY = 'insertseq.history';
const HISTORY_MAX =
	Number(
		vscode.workspace.getConfiguration('insertseq.history').get('maxItems'),
	) || 100;

export function getHistory(ctx: vscode.ExtensionContext): string[] {
	return ctx.globalState.get<string[]>(HISTORY_KEY, []);
}

export async function saveToHistory(
	ctx: vscode.ExtensionContext,
	command: string | undefined,
): Promise<void> {
	if (command == null) return;

	// ensure non-empty command
	if (command === '') command = '1';

	const raw = getHistory(ctx);

	const filtered = raw.filter((e) => e !== command);

	filtered.unshift(command);
	if (filtered.length > HISTORY_MAX) filtered.length = HISTORY_MAX;
	await ctx.globalState.update(HISTORY_KEY, filtered);
}

export async function clearHistory(ctx: vscode.ExtensionContext) {
	await ctx.globalState.update(HISTORY_KEY, []);
}

export async function deleteFromHistory(ctx: vscode.ExtensionContext, item: string) {
	if (!item) return;
	const list = getHistory(ctx).filter(x => x !== item);
	await ctx.globalState.update(HISTORY_KEY, list);
}
