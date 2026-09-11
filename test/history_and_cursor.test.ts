import { describe, it, expect, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import {
	saveToHistory,
	getHistory,
	clearHistory,
	deleteFromHistory,
} from '../src/components/history';

function createMockExtensionContext(): vscode.ExtensionContext {
	const storage = new Map<string, any>();
	return {
		globalState: {
			get: (key: string, defaultValue?: any) => {
				return storage.has(key) ? storage.get(key) : defaultValue;
			},
			update: async (key: string, value: any) => {
				storage.set(key, value);
			},
			keys: () => Array.from(storage.keys()),
			setKeysForSync: () => {},
		},
		workspaceState: {} as any,
		secrets: {} as any,
		subscriptions: [],
		extensionUri: vscode.Uri.file('/mock'),
		extensionPath: '/mock',
		asAbsolutePath: (p: string) => p,
		storageUri: undefined,
		storagePath: undefined,
		globalStorageUri: vscode.Uri.file('/mock/storage'),
		globalStoragePath: '/mock/storage',
		logUri: vscode.Uri.file('/mock/log'),
		logPath: '/mock/log',
		extensionMode: 1 as any,
		environmentVariableCollection: {} as any,
	} as any;
}

describe('History, Multi-Cursor & WorkspaceEdit', () => {
	let ctx: vscode.ExtensionContext;

	beforeEach(() => {
		ctx = createMockExtensionContext();
	});

	describe('History Management', () => {
		it('ignores undefined or null command on cancellation', async () => {
			await saveToHistory(ctx, undefined);
			expect(getHistory(ctx)).toEqual([]);
			await saveToHistory(ctx, null as any);
			expect(getHistory(ctx)).toEqual([]);
		});

		it('saves valid command and normalizes empty string to "1"', async () => {
			await saveToHistory(ctx, '1:5');
			expect(getHistory(ctx)).toEqual(['1:5']);

			await saveToHistory(ctx, '');
			expect(getHistory(ctx)).toEqual(['1', '1:5']);
		});

		it('deduplicates items and promotes recent item to front', async () => {
			await saveToHistory(ctx, 'a:1');
			await saveToHistory(ctx, 'b:2');
			await saveToHistory(ctx, 'a:1');

			expect(getHistory(ctx)).toEqual(['a:1', 'b:2']);
		});

		it('deletes an item by exact string match', async () => {
			await saveToHistory(ctx, 'first');
			await saveToHistory(ctx, 'second');
			await deleteFromHistory(ctx, 'first');

			expect(getHistory(ctx)).toEqual(['second']);
		});

		it('clears all history entries', async () => {
			await saveToHistory(ctx, 'entry1');
			await saveToHistory(ctx, 'entry2');
			await clearHistory(ctx);

			expect(getHistory(ctx)).toEqual([]);
		});
	});

	describe('Atomic WorkspaceEdit', () => {
		it('records replaces, inserts and deletes in WorkspaceEdit', async () => {
			const edit = new vscode.WorkspaceEdit();
			const uri = vscode.Uri.file('/test/doc.txt');
			const range1 = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 5));
			const pos1 = new vscode.Position(1, 0);

			edit.replace(uri, range1, 'replaced-text');
			edit.insert(uri, pos1, 'inserted-line\n');
			edit.delete(uri, range1);

			expect(edit.has(uri)).toBe(true);
			const entries = edit.entries();
			expect(entries.length).toBeGreaterThan(0);
		});

		it('applies edits via vscode.workspace.applyEdit', async () => {
			const edit = new vscode.WorkspaceEdit();
			const uri = vscode.Uri.file('/test/doc.txt');
			edit.replace(uri, new vscode.Range(0, 0, 0, 1), 'x');

			const success = await vscode.workspace.applyEdit(edit);
			expect(success).toBe(true);
		});
	});
});

