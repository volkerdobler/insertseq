import { vi } from 'vitest';

export const mockConfigStore: Record<string, any> = {};

export function setMockConfig(key: string, value: any) {
	mockConfigStore[key] = value;
}

export function resetMockConfig() {
	for (const key of Object.keys(mockConfigStore)) {
		delete mockConfigStore[key];
	}
}

export class MockPosition {
	constructor(public line: number, public character: number) {}
}

export class MockRange {
	public start: MockPosition;
	public end: MockPosition;
	constructor(
		startOrStartLine: MockPosition | number,
		endOrStartChar: MockPosition | number,
		endLine?: number,
		endChar?: number,
	) {
		if (typeof startOrStartLine === 'number') {
			this.start = new MockPosition(startOrStartLine, endOrStartChar as number);
			this.end = new MockPosition(endLine!, endChar!);
		} else {
			this.start = startOrStartLine;
			this.end = endOrStartChar as MockPosition;
		}
	}
}

export class MockSelection extends MockRange {
	public anchor: MockPosition;
	public active: MockPosition;
	constructor(anchor: MockPosition, active: MockPosition) {
		super(anchor, active);
		this.anchor = anchor;
		this.active = active;
	}
}

export class MockWorkspaceEdit {
	public edits: Array<{ type: string; uri: any; rangeOrPos: any; text: string }> = [];
	replace(uri: any, range: any, text: string) {
		this.edits.push({ type: 'replace', uri, rangeOrPos: range, text });
	}
	insert(uri: any, position: any, text: string) {
		this.edits.push({ type: 'insert', uri, rangeOrPos: position, text });
	}
	delete(uri: any, range: any) {
		this.edits.push({ type: 'delete', uri, rangeOrPos: range, text: '' });
	}
	has(uri: any) {
		return this.edits.some((e) => e.uri === uri);
	}
	entries() {
		return [[undefined, this.edits]];
	}
}

export const vscodeMock = {
	ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
	InputBoxValidationSeverity: {
		Info: 1,
		Warning: 2,
		Error: 3,
	},
	Position: MockPosition,
	Range: MockRange,
	Selection: MockSelection,
	Uri: {
		file: (path: string) => ({ fsPath: path, scheme: 'file' }),
	},
	ThemeColor: function (id: string) {
		(this as any).id = id;
	},
	EventEmitter: class {
		private listeners: Function[] = [];
		get event() {
			return (listener: Function) => {
				this.listeners.push(listener);
				return { dispose: () => {} };
			};
		}
		fire(data?: any) {
			for (const l of this.listeners) {
				l(data);
			}
		}
		dispose() {
			this.listeners = [];
		}
	},
	InlineCompletionList: function (items: any[]) {
		(this as any).items = items;
	},
	InlineCompletionItem: function (text: string, range?: any) {
		(this as any).insertText = text;
		(this as any).range = range;
	},
	WorkspaceEdit: MockWorkspaceEdit,
	workspace: {
		getConfiguration: () => ({
			get: (key: string) => mockConfigStore[key],
			update: async (key: string, value: any) => {
				mockConfigStore[key] = value;
			},
		}),
		applyEdit: async (_edit: any) => true,
	},
	window: {
		createOutputChannel: () => ({
			appendLine: () => {},
			dispose: () => {},
		}),
		createTextEditorDecorationType: (options: any) => ({
			key: 'mock-dec',
			dispose: () => {},
			options,
		}),
	},
	env: {
		language: 'en',
	},
};

vi.mock('vscode', () => vscodeMock);

