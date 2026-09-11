import * as vscode from 'vscode';

let currentDecorationType: vscode.TextEditorDecorationType | null = null;
let currentMode: string | null = null;
let currentColor: string | null = null;

/**
 * Returns or re-creates the TextEditorDecorationType based on current settings.
 *
 * In 'ghostText' mode:
 * - Uses VS Code's native theme color `editorGhostText.foreground`
 * - Sets italic font style to match native VS Code inline completion styling
 *
 * In 'decoration' mode:
 * - Uses the configured `insertseq.previewColor` (defaults to #888888)
 */
export function getPreviewDecorationType(
	config: vscode.WorkspaceConfiguration,
): vscode.TextEditorDecorationType {
	const mode: string = config.get('previewMode') || 'ghostText';
	const color: string = config.get('previewColor') || '#888888';

	if (currentDecorationType && currentMode === mode && currentColor === color) {
		return currentDecorationType;
	}

	if (currentDecorationType) {
		try {
			currentDecorationType.dispose();
		} catch {
			/* ignore */
		}
		currentDecorationType = null;
	}

	currentMode = mode;
	currentColor = color;

	if (mode === 'ghostText') {
		currentDecorationType = vscode.window.createTextEditorDecorationType({
			after: {
				color: new vscode.ThemeColor('editorGhostText.foreground'),
				fontStyle: 'italic',
				margin: '0 0 0 0',
			},
		});
	} else {
		currentDecorationType = vscode.window.createTextEditorDecorationType({
			after: {
				color: color,
				margin: '0 0 0 0',
			},
		});
	}

	return currentDecorationType;
}

/**
 * Disposes of the active preview decoration type if allocated.
 */
export function disposePreviewDecorationType(): void {
	if (currentDecorationType) {
		try {
			currentDecorationType.dispose();
		} catch {
			/* ignore */
		}
		currentDecorationType = null;
		currentMode = null;
		currentColor = null;
	}
}

/**
 * Formats a single preview string for decoration display:
 * - Converts tabs to non-breaking spaces according to editor tabSize
 * - Converts real newlines into visual return symbol (\u21b5) to avoid breaking VS Code's single-line decoration constraint
 * - Converts remaining whitespace to non-breaking spaces
 */
export function formatPreviewText(str: string, tabSize: number = 4): string {
	if (!str) {
		return '';
	}
	const safeTabSize = Math.max(1, tabSize);
	return str
		.replace(/\t/g, '\u00A0'.repeat(safeTabSize))
		.replace(/\r?\n/g, '\u21b5 ')
		.replace(/\s/g, '\u00A0');
}

/**
 * Formats overflow items (when generated sequence items exceed cursor count)
 * into a compact, non-disruptive preview string:
 * - Caps preview at `maxVisible` items
 * - Appends ` … (+N more)` when items exceed `maxVisible`
 * This prevents horizontal scrolling blowout and layout shifts.
 */
export function buildOverflowPreview(
	items: string[],
	delimiter: string | null = null,
	maxVisible: number = 5,
): string {
	if (!items || items.length === 0) {
		return '';
	}
	const sep = delimiter !== null && delimiter !== undefined && delimiter !== '' ? delimiter : '\u21b5';
	if (items.length <= maxVisible) {
		return items.join(sep);
	}
	const visible = items.slice(0, maxVisible).join(sep);
	const remaining = items.length - maxVisible;
	return `${visible} … (+${remaining} more)`;
}

/**
 * Native VS Code InlineCompletionItemProvider implementation.
 * Allows VS Code to render native ghost text completions at cursor positions
 * during live preview updates.
 */
export class InsertSeqInlineCompletionProvider
	implements vscode.InlineCompletionItemProvider
{
	private _onDidChange = new vscode.EventEmitter<void>();
	public readonly onDidChangeInlineCompletions = this._onDidChange.event;
	private _items: vscode.InlineCompletionItem[] = [];

	public update(items: vscode.InlineCompletionItem[]): void {
		this._items = items;
		this._onDidChange.fire();
	}

	public clear(): void {
		if (this._items.length > 0) {
			this._items = [];
			this._onDidChange.fire();
		}
	}

	public provideInlineCompletionItems(
		_document: vscode.TextDocument,
		_position: vscode.Position,
		_context: vscode.InlineCompletionContext,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.InlineCompletionList | vscode.InlineCompletionItem[]> {
		if (this._items.length === 0) {
			return undefined;
		}
		return new vscode.InlineCompletionList(this._items);
	}

	public dispose(): void {
		this._onDidChange.dispose();
		this._items = [];
	}
}

