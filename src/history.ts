import * as vscode from 'vscode';

// -------------------- History helpers --------------------
const HISTORY_KEY = 'insertseq.history';
const OLD_HISTORY_KEY = 'history';
const HISTORY_MAX =
	Number(
		vscode.workspace.getConfiguration('insertseq').get('maxHistoryItems'),
	) || 100;

export async function migrateOldHistory(
	ctx: vscode.ExtensionContext,
): Promise<void> {
	try {
		const old = ctx.globalState.get<string[]>(OLD_HISTORY_KEY, []) || [];
		if (!old.length) return;

		const current = getHistory(ctx); // reads HISTORY_KEY
		const merged: string[] = [];

		// skip old month inputs starting with ;
		const oldMonthInput = new RegExp(/^;/);
		// preserve order: take old first (assumed most-recent-first), then append current items not already present
		for (const it of old) {
			if (it && !oldMonthInput.test(it) && !merged.includes(it)) merged.push(it);
		}
		for (const it of current) {
			if (it && !merged.includes(it)) merged.push(it);
		}

		if (merged.length > HISTORY_MAX) merged.length = HISTORY_MAX;
		await ctx.globalState.update(HISTORY_KEY, merged);

		// clear old history to avoid duplicate future migrations
		await ctx.globalState.update(OLD_HISTORY_KEY, []);
	} catch (err) {
		console.error('insertseq: history migration failed', err);
	}
}

export function getHistory(ctx: vscode.ExtensionContext): string[] {
	return ctx.globalState.get<string[]>(HISTORY_KEY, []) || [];
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

export async function deleteFromHistory(
	ctx: vscode.ExtensionContext,
	item: string,
) {
	if (!item) return;
	const list = getHistory(ctx).filter((x) => x !== item);
	await ctx.globalState.update(HISTORY_KEY, list);
}
