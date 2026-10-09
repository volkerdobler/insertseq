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

	describe('Section 8.1: Overflow Line Trailing-Text Shift (delimiter === null)', () => {
		function createMockTextEditor(lines: string[], cursorSelections: vscode.Selection[]) {
			let docLines = [...lines];
			const uri = vscode.Uri.file('/test/mockDoc.txt');

			const document: any = {
				uri,
				eol: 1, // vscode.EndOfLine.LF
				get lineCount() {
					return docLines.length;
				},
				lineAt(lineNum: number) {
					const text = docLines[lineNum] ?? '';
					return {
						lineNumber: lineNum,
						text,
						range: new vscode.Range(new vscode.Position(lineNum, 0), new vscode.Position(lineNum, text.length)),
					};
				},
				getText(range?: vscode.Range) {
					if (!range) {
						return docLines.join('\n');
					}
					if (range.start.line === range.end.line) {
						const line = docLines[range.start.line] ?? '';
						return line.substring(range.start.character, range.end.character);
					}
					return '';
				},
			};

			const editor: any = {
				document,
				options: { tabSize: 4 },
				setDecorations: () => {},
			};

			const applyDocEdits = (edit: any) => {
				const edits = edit.edits as Array<{ type: string; uri: any; rangeOrPos: any; text: string }>;
				for (const e of edits) {
					if (e.type === 'replace') {
						const range = e.rangeOrPos;
						const line = docLines[range.start.line];
						docLines[range.start.line] =
							line.substring(0, range.start.character) + e.text + line.substring(range.end.character);
					} else if (e.type === 'delete') {
						const range = e.rangeOrPos;
						const line = docLines[range.start.line];
						docLines[range.start.line] =
							line.substring(0, range.start.character) + line.substring(range.end.character);
					} else if (e.type === 'insert') {
						const pos = e.rangeOrPos;
						const inserted = e.text.split('\n');
						if (pos.line >= docLines.length) {
							// eolString + overflowContent
							const textToAppend = e.text.startsWith('\n') ? e.text.slice(1) : e.text;
							docLines.push(...textToAppend.split('\n'));
						} else {
							// overflowContent + eolString
							const linesToInsert = inserted[inserted.length - 1] === '' ? inserted.slice(0, -1) : inserted;
							docLines.splice(pos.line, 0, ...linesToInsert);
						}
					}
				}
			};

			return { editor, docLines, applyDocEdits };
		}

		it('shifts trailing line content to end of overflow lines when cursor is at start of line (|abc)', async () => {
			const { insertNewSequence } = await import('../src/extension');
			const { getRegExpressions } = await import('../src/components/evaluator');

			const mock = createMockTextEditor(['abc'], [
				new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)),
			]);

			const param: any = {
				editor: mock.editor,
				segments: getRegExpressions(),
				origCursorPos: [new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0))],
				origTextSel: [''],
				config: {
					get: (key: string) => (key === 'maxInsertions' ? 1000 : undefined),
				},
				myDelimiter: null,
			};

			const originalApplyEdit = vscode.workspace.applyEdit;
			vscode.workspace.applyEdit = async (edit: any) => {
				mock.applyDocEdits(edit);
				return true;
			};

			try {
				await insertNewSequence('1@i>2', param, 'final');
				expect(mock.docLines).toEqual(['1', '2', '3', 'abc']);
			} finally {
				vscode.workspace.applyEdit = originalApplyEdit;
			}
		});

		it('preserves prefix on line 1 and appends suffix to last overflow line when cursor is in middle (foo|bar)', async () => {
			const { insertNewSequence } = await import('../src/extension');
			const { getRegExpressions } = await import('../src/components/evaluator');

			const mock = createMockTextEditor(['foobar'], [
				new vscode.Selection(new vscode.Position(0, 3), new vscode.Position(0, 3)),
			]);

			const param: any = {
				editor: mock.editor,
				segments: getRegExpressions(),
				origCursorPos: [new vscode.Selection(new vscode.Position(0, 3), new vscode.Position(0, 3))],
				origTextSel: [''],
				config: {
					get: (key: string) => (key === 'maxInsertions' ? 1000 : undefined),
				},
				myDelimiter: null,
			};

			const originalApplyEdit = vscode.workspace.applyEdit;
			vscode.workspace.applyEdit = async (edit: any) => {
				mock.applyDocEdits(edit);
				return true;
			};

			try {
				await insertNewSequence('1@i>2', param, 'final');
				expect(mock.docLines).toEqual(['foo1', '2', '3bar']);
			} finally {
				vscode.workspace.applyEdit = originalApplyEdit;
			}
		});

		it('does not append extra empty line when cursor is at end of line (abc|)', async () => {
			const { insertNewSequence } = await import('../src/extension');
			const { getRegExpressions } = await import('../src/components/evaluator');

			const mock = createMockTextEditor(['abc'], [
				new vscode.Selection(new vscode.Position(0, 3), new vscode.Position(0, 3)),
			]);

			const param: any = {
				editor: mock.editor,
				segments: getRegExpressions(),
				origCursorPos: [new vscode.Selection(new vscode.Position(0, 3), new vscode.Position(0, 3))],
				origTextSel: [''],
				config: {
					get: (key: string) => (key === 'maxInsertions' ? 1000 : undefined),
				},
				myDelimiter: null,
			};

			const originalApplyEdit = vscode.workspace.applyEdit;
			vscode.workspace.applyEdit = async (edit: any) => {
				mock.applyDocEdits(edit);
				return true;
			};

			try {
				await insertNewSequence('1@i>2', param, 'final');
				expect(mock.docLines).toEqual(['abc1', '2', '3']);
			} finally {
				vscode.workspace.applyEdit = originalApplyEdit;
			}
		});

		it('inserts horizontally and shifts text to right when explicit horizontal delimiter is used (foo|bar with space)', async () => {
			const { insertNewSequence } = await import('../src/extension');
			const { getRegExpressions } = await import('../src/components/evaluator');

			const mock = createMockTextEditor(['foobar'], [
				new vscode.Selection(new vscode.Position(0, 3), new vscode.Position(0, 3)),
			]);

			const param: any = {
				editor: mock.editor,
				segments: getRegExpressions(),
				origCursorPos: [new vscode.Selection(new vscode.Position(0, 3), new vscode.Position(0, 3))],
				origTextSel: [''],
				config: {
					get: (key: string) => (key === 'maxInsertions' ? 1000 : undefined),
				},
				myDelimiter: ' ',
			};

			const originalApplyEdit = vscode.workspace.applyEdit;
			vscode.workspace.applyEdit = async (edit: any) => {
				mock.applyDocEdits(edit);
				return true;
			};

			try {
				await insertNewSequence('1_ :1@i>2', param, 'final');
				expect(mock.docLines).toEqual(['foo1 2 3bar']);
			} finally {
				vscode.workspace.applyEdit = originalApplyEdit;
			}
		});

		it('handles multiple cursors with overflow on the last cursor (line0, line1 with trailing text)', async () => {
			const { insertNewSequence } = await import('../src/extension');
			const { getRegExpressions } = await import('../src/components/evaluator');

			const mock = createMockTextEditor(['firstLine', 'secondTail'], [
				new vscode.Selection(new vscode.Position(0, 5), new vscode.Position(0, 5)),
				new vscode.Selection(new vscode.Position(1, 6), new vscode.Position(1, 6)),
			]);

			const param: any = {
				editor: mock.editor,
				segments: getRegExpressions(),
				origCursorPos: [
					new vscode.Selection(new vscode.Position(0, 5), new vscode.Position(0, 5)),
					new vscode.Selection(new vscode.Position(1, 6), new vscode.Position(1, 6)),
				],
				origTextSel: ['', ''],
				config: {
					get: (key: string) => (key === 'maxInsertions' ? 1000 : undefined),
				},
				myDelimiter: null,
			};

			const originalApplyEdit = vscode.workspace.applyEdit;
			vscode.workspace.applyEdit = async (edit: any) => {
				mock.applyDocEdits(edit);
				return true;
			};

			try {
				// 2 cursors, 4 items: '1', '2', '3', '4' -> cursor 0 gets '1', cursor 1 gets '2', overflow gets '3', '4' + 'Tail'
				await insertNewSequence('1@i>3', param, 'final');
				expect(mock.docLines).toEqual(['first1Line', 'second2', '3', '4Tail']);
			} finally {
				vscode.workspace.applyEdit = originalApplyEdit;
			}
		});

		it('selects/places cursors on all inserted lines when more lines are inserted than cursors (1 cursor -> 4 lines)', async () => {
			const { insertNewSequence } = await import('../src/extension');
			const { getRegExpressions } = await import('../src/components/evaluator');

			const mock = createMockTextEditor(['', ''], [
				new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0)),
			]);

			const param: any = {
				editor: mock.editor,
				segments: getRegExpressions(),
				origCursorPos: [new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0))],
				origTextSel: [''],
				config: {
					get: (key: string) => (key === 'maxInsertions' ? 1000 : undefined),
				},
				myDelimiter: null,
			};

			const originalApplyEdit = vscode.workspace.applyEdit;
			vscode.workspace.applyEdit = async (edit: any) => {
				mock.applyDocEdits(edit);
				return true;
			};

			try {
				// 1 cursor at (0, 0), sequence 1@i>3 -> '1', '2', '3', '4'
				await insertNewSequence('1@i>3', param, 'final');
				expect(mock.docLines).toEqual(['1', '2', '3', '4', '']);
				expect(mock.editor.selections).toHaveLength(4);
				expect(mock.editor.selections[0].start.line).toBe(0);
				expect(mock.editor.selections[0].start.character).toBe(1);
				expect(mock.editor.selections[1].start.line).toBe(1);
				expect(mock.editor.selections[1].start.character).toBe(1);
				expect(mock.editor.selections[2].start.line).toBe(2);
				expect(mock.editor.selections[2].start.character).toBe(1);
				expect(mock.editor.selections[3].start.line).toBe(3);
				expect(mock.editor.selections[3].start.character).toBe(1);
			} finally {
				vscode.workspace.applyEdit = originalApplyEdit;
			}
		});
	});
});

