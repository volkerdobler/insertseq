/*
The idea of the extension "InsertSeq" (previous InsertNums) based on the plugin insertnums 
for sublimecode from James Brooks
Version 1.0 is completely rewritten and additional features are added.

Original sublimecode extension: https://github.com/jbrooksuk/InsertNums
Version 1.0 has some inspirations from the extension "VSCodeExtensionInsertSequence" (https://github.com/kuone314/VSCodeExtensionInsertSequence) by kuone314

Volker Dobler
original from May 2020
rewritten November 2025
last update May 2026

*/

// external modules
import * as vscode from 'vscode';

// internal modules
import { TInput, TStatus, TParameter } from './types';
import {
	getHistory,
	saveToHistory,
	clearHistory,
	deleteFromHistory,
	migrateOldHistory,
} from './components/history';
import {
	setDebugMode,
	setOutputChannel,
	removeOutputChannel,
	printToConsole,
} from './components/utils';
import { getRegExpressions } from './components/evaluator';
import { createDecimalSeq } from './sequences/decimal';
import { createStringSeq } from './sequences/string';
import { createDateSeq } from './sequences/date';
import { createExpressionSeq } from './sequences/expression';
import { createOwnSeq } from './sequences/own';
import { createPredefinedSeq } from './sequences/predefined';
import { createFunctionSeq } from './sequences/function';
import { createTextSelectedSeq } from './sequences/textSelected';

/**
 * Extension entry point called by VS Code when the extension is first activated.
 *
 * Registers the two commands (`extension.insertseq` and
 * `extension.insertseq.history`) and migrates any legacy history data.
 *
 * @param context - The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
	// migrate any legacy history into the new key before registering commands
	migrateOldHistory(context).catch(() => {
		/* ignore migration errors */
	});
	// set output channel for debug messages
	setOutputChannel('InsertSeq');
	// register insertseq command (normal insertion)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'extension.insertseq',
			(value: string) => {
				InsertSeqCommand(context, value);
				printToConsole(
					'Congratulations, extension "insertseq" is now active!',
				);
			},
		),
	);
	// register insertseq.history command (insertion from history / previous insertions)
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'extension.insertseq.history',
			(value: string) => {
				InsertSeqHistory(context, value);
				printToConsole(
					'Congratulations, extension "insertseq.history" is now active!',
				);
			},
		),
	);
}

/** Extension teardown hook — disposes the debug output channel. */
export function deactivate() {
	removeOutputChannel();
}

const appName: string = 'insertseq';

// Default configuration values (will be overwritten by user settings)
let previewDecorationType: vscode.TextEditorDecorationType | null = null;

/**
 * Return `selections` optionally sorted top-to-bottom and/or reversed.
 * When neither flag is set the original order (multi-cursor click order) is preserved.
 *
 * @param selections - Array of cursor selections to reorder.
 * @param sort - Sort top-to-bottom before reversing.
 * @param reverse - Reverse the (possibly sorted) array.
 * @returns A new array in the requested order.
 */
function sortSelectionsByPosition(
	selections: vscode.Selection[],
	sort: boolean = false,
	reverse: boolean = false,
): vscode.Selection[] {
	const tempSelections = sort
		? selections.slice().sort((a, b) => {
				if (a.start.line === b.start.line) {
					return a.start.character - b.start.character;
				}
				return a.start.line - b.start.line;
			})
		: selections;

	return reverse ? tempSelections.slice().reverse() : tempSelections;
}

// Syntaxes for different input types:
// ===================================
// decimals: [<start>[r[+]<random>][?<delimiter>]][:<step>][#<repeat>][*<frequency>][##startover][~<format>][::<expr>][@<stopexpr>][$][!]
// alpha: <start>[:<step>][#<repeat>][*<frequency>][##startover][~<format>][::<expr>][@<stopexpr>][w][$][!]
// dates: %[<year>[-<month>[-<day>]]][:<step>[dwmy]][#<repeat>][*<frequency>][##startover][~<format>][$][!]
// expressions: |<expr>[~<format>][@<stopexpr>][$][!]
// own (war "months"): ;<start>[:<step>][#<repeat>][\*<frequency>][##startover][~<format>][@<stopexpr>][$][!]
// predefined: <predefinedList as array>[?[whicharray[|startat]][ifs]][:<step>][#<repeat>][\*<frequency>][##startover][~<format>][@<stopexpr>][$][!]
// tempplate: ["']Text {} Text["'] SEQUENCE
// backtick template: `Text {SEQUENCE} Text {SEQUENCE}`

/**
 * Initialise the shared {@link TParameter} context for a command invocation.
 *
 * Reads the workspace configuration, compiles the regex segments, captures
 * the currently selected text, and **deletes** the selection content so that
 * the cursor positions are left at the insertion points. The deleted text is
 * stored in the returned context and restored if the user cancels.
 *
 * @param editor - The active text editor.
 * @returns The fully populated parameter object to be passed into sequence functions.
 */
async function initApp(editor: vscode.TextEditor): Promise<TParameter> {
	// read config file, since version 1.0 insertnums config entries are no longer merged
	const config = Object.assign(
		{},
		vscode.workspace.getConfiguration(appName),
	);

	// check, if debug mode is true. If true, all printToConsole will write text to outputchannel or console
	setDebugMode(config.get('debug') || false);

	// read regular Expression for segmenting the input string
	const regexpInputSegments = getRegExpressions();

	// get current selected Text
	const origTextSelections = editor.selections.map((selection) =>
		editor.document.getText(selection),
	);

	// delete current selected Text (will be inserted later when input is cancelled). Wait for edit to finish because of the following cursor position reading.
	await editor.edit((builder) => {
		editor.selections.forEach((selection) => {
			builder.replace(selection, '');
		});
	});

	// get current (multi-)cursor positions (without original selected Text)
	const origCursorPositions = editor.selections.map(
		(selection) => new vscode.Selection(selection.start, selection.start),
	);

	printToConsole('UI Kind: ' + vscode.env.uiKind.toString());
	const isWeb = vscode.env.uiKind === vscode.UIKind.Web;
	if (isWeb) {
		printToConsole('Running in web (vscode.dev / web extension host)');
	} else {
		printToConsole('Running in desktop VS Code (local extension host)');
	}

	// global parameter for sequence creation which will be passed to subfunctions
	return {
		editor: editor,
		origCursorPos: origCursorPositions,
		origTextSel: origTextSelections,
		segments: regexpInputSegments,
		config: config,
		myDelimiter: null,
	};
}

/**
 * Main command handler — shows the sequence input box and inserts the result.
 * Default keybinding: `Ctrl+Alt+.` / `Cmd+Alt+.`.
 *
 * A live decoration preview is updated on every keystroke via `validateInput`.
 * On confirmation the final sequence is written to the document and saved to
 * history; on cancellation the originally selected text is restored.
 *
 * @param context - The extension context (used for history persistence).
 * @param value - Pre-filled input value (e.g. when editing a history entry).
 */
async function InsertSeqCommand(
	context: vscode.ExtensionContext,
	value: string,
) {
	// get active editor, if not available show info message and return
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showInformationMessage('No active editor!');
		return;
	}

	// get global parameter (config, regex, original selections etc.) - will be passed to subfunctions
	const parameter: TParameter = await initApp(editor);

	printToConsole('Initialized parameters for InsertSeqCommand');

	// set input box options for sequence input, including placeHolder, predefined value if available and live preview as decorations
	const inputOptions: vscode.InputBoxOptions = {
		placeHolder:
			'[<start>][:<step>][*<frequency>][#<repeat>][##startover][~<format>][::<expr>][@<stopexpr>]["Template {}"][`Backtick {} more {}`][$][!]',
		value: value,
		validateInput: function (input) {
			if (parameter.config.get('previewStatus') !== false) {
				printToConsole('Previewing input: ' + input);
				insertNewSequence(input, parameter, 'preview');
			}
			return '';
		},
	};

	// show input box based on above options
	vscode.window.showInputBox(inputOptions).then(function (
		input: string | undefined,
	) {
		// insert final sequence (check if canceled will be done in insertNewSequence and in saveToHistory)
		insertNewSequence(input, parameter, 'final');
		if (input != null) {
			// save input to local history storage
			saveToHistory(context, input);
		}
	});
}

/**
 * History command handler — shows a QuickPick of previous sequences.
 * Default keybinding: `Ctrl+Alt+,` / `Cmd+Alt+,`.
 *
 * Selecting an entry immediately executes it. Choosing "New sequence" delegates
 * to {@link InsertSeqCommand}. Each entry has edit and delete buttons.
 * If the history is empty, falls back directly to {@link InsertSeqCommand}.
 *
 * @param context - The extension context (used for history persistence).
 * @param value - Passed through to {@link InsertSeqCommand} when "New sequence" is chosen.
 */
async function InsertSeqHistory(
	context: vscode.ExtensionContext,
	value: string,
) {
	// get active editor
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	// get global parameter (config, regex, original selections etc.) - will be passed to subfunctions
	const parameter: TParameter = await initApp(editor);

	// build QuickPick items: top 'New sequence', then history newest-first
	const qp = createQuickPick(context, parameter);

	if (qp.items.length > 1) {
		// show QuickPick if more than 1 item
		qp.show();
	} else {
		// show normal input box if no items beside "new sequence" are in the history
		InsertSeqCommand(context, value);
	}
}

/**
 * Core insertion engine — generates the sequence values and either shows them
 * as decoration previews or writes them permanently to the document.
 *
 * **Preview mode:** renders each value as an `after`-decoration at the cursor
 * position; excess values are appended to the last decoration with a `↵` separator.
 *
 * **Final mode:** replaces each cursor position with its value; excess values
 * are inserted as new lines (or concatenated with the configured delimiter).
 * When `input` is `undefined` (cancelled), the originally selected text is restored.
 *
 * @param input - Parsed user input string, or `undefined` when cancelled.
 * @param parameter - Shared command context.
 * @param status - `"preview"` to show decorations, `"final"` to commit to the document.
 */
function insertNewSequence(
	input: string | undefined, // der eingegebene Text
	parameter: TParameter,
	status: TStatus,
): void {
	// check, if output should be sorted or reversed (default: output in selection-order)
	const sorted =
		(input && input.match(parameter.segments['outputSort'])) ?? null;
	const reverse =
		(input && input.match(parameter.segments['outputReverse'])) ?? null;

	// get current sequence function based on input type
	const currSeqFunction = getSequenceFunction(input, parameter);

	// generate new sequence input strings (up to stop expression or maxInsertions)
	const strList: string[] = [];
	for (
		let i = 0;
		i < (Number(parameter.config.get('maxInsertions')) || 10000);
		i++
	) {
		// build strList-Array until stop expression is true or maxInsertions reached
		const res = currSeqFunction(i);
		if (res.stopFunction) {
			break;
		}
		// Replace \\t in Input with real TAB
		strList.push(res.stringFunction.replace(/\\t/g, '\t'));
	}

	// get delimiter and newLine settings from configuration (if insertations exceed number of selections)
	const delimiter: string | null =
		parameter.myDelimiter || parameter.config.get('delimiter') || null;
	// select proper EOL string for current document
	const eolString =
		parameter.editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';

	// define preview decoration type if not yet done
	if (!previewDecorationType) {
		previewDecorationType = vscode.window.createTextEditorDecorationType({
			after: {
				color: parameter.config.previewColor ?? '#888888',
				margin: '0 0 0 0',
			},
		});
	}
	// clear previous decorations
	parameter.editor.setDecorations(previewDecorationType, []);

	// get sorted/reversed cursor positions for insertions
	const insertCursorPos = sortSelectionsByPosition(
		parameter.origCursorPos,
		sorted ? true : false,
		reverse ? true : false,
	);

	// convert a string for use in decoration contentText:
	// tabs → repeated non-breaking spaces (editor tab width), other whitespace → single non-breaking space
	const tabSize =
		typeof parameter.editor.options.tabSize === 'number'
			? parameter.editor.options.tabSize
			: 4;
	const toDecorationText = (s: string) =>
		s.replace(/\t/g, ' '.repeat(tabSize)).replace(/\s/g, ' ');

	// handle preview or final insertion
	switch (status) {
		case 'preview':
			// preview with Decorations
			// clear previous decorations
			const decorations: vscode.DecorationOptions[] = [];

			// safe last inserted string for possible appending at the end
			let addStr = '';

			// for each created string, create a decoration. If the number of created strings is higher than the number of original cursors, "new lines" will be inserted.
			strList.forEach((str, index) => {
				// create decoration at original cursor position as far as original cursor positions exist
				if (index < insertCursorPos.length) {
					let decoration = {
						range: new vscode.Range(
							insertCursorPos[index].start.line,
							insertCursorPos[index].start.character,
							insertCursorPos[index].end.line,
							insertCursorPos[index].end.character,
						),
						renderOptions: {
							after: {
								contentText: toDecorationText(str),
							},
						},
					};
					decorations.push(decoration);
					// safe last inserted string for possible appending at the end
					addStr = str;
				}
			});
			// if more created strings than original cursors, append the rest at the end (with delimiter or newline symbol)
			if (strList.length > insertCursorPos.length) {
				const lastPos = insertCursorPos[insertCursorPos.length - 1];
				decorations.pop();
				for (let i = insertCursorPos.length; i < strList.length; i++) {
					addStr += (delimiter ? delimiter : '\u21b5') + strList[i]; // \u21b5 = downwards arrow with corner leftwards
				}
				let decoration = {
					range: new vscode.Range(
						lastPos.start.line,
						lastPos.start.character,
						lastPos.end.line,
						lastPos.end.character,
					),
					renderOptions: {
						after: {
							contentText: toDecorationText(addStr),
						},
					},
				};
				decorations.push(decoration);
			}
			parameter.editor.setDecorations(previewDecorationType, decorations);
			break;
		case 'final':
			// final insertion
			// clear previous decorations
			parameter.editor.setDecorations(previewDecorationType, []);
			try {
				previewDecorationType.dispose();
			} catch {
				printToConsole('Error disposing previewDecorationType');
			}
			previewDecorationType = null;

			parameter.editor.edit((builder) => {
				let addStr = '';
				const overflowLines: string[] = [];

				// if no strings created, use original selected text as backup
				if (strList.length === 0) {
					parameter.origTextSel.map((s) => strList.push(s));
				}

				const maxIndex =
					delimiter == null
						? insertCursorPos.length
						: insertCursorPos.length - 1;

				// for each created string, insert at original cursor position. If more strings than original cursors, insert the rest at the end (with delimiter or newline symbol)
				strList.forEach((str, index) => {
					if (index < maxIndex) {
						const currSel = new vscode.Selection(
							insertCursorPos[index].start.line,
							insertCursorPos[index].start.character,
							insertCursorPos[index].end.line,
							insertCursorPos[index].end.character,
						);
						builder.replace(currSel, str);
					} else {
						if (delimiter == null) {
							overflowLines.push(str);
						} else {
							addStr += str + delimiter;
						}
					}
				});

				// insert all overflow lines as a single operation to preserve correct order
				if (overflowLines.length > 0) {
					const lastLine = insertCursorPos[maxIndex - 1].start.line;
					const insertPos = new vscode.Position(lastLine + 1, 0);
					if (
						insertPos.line === parameter.editor.document.lineCount
					) {
						builder.insert(
							insertPos,
							eolString + overflowLines.join(eolString),
						);
					} else {
						builder.insert(
							insertPos,
							overflowLines.join(eolString) + eolString,
						);
					}
				}

				if (addStr.length > 0) {
					const lastPos = insertCursorPos[insertCursorPos.length - 1];
					const currSel = new vscode.Range(
						lastPos.start.line,
						lastPos.start.character,
						lastPos.end.line,
						lastPos.end.character,
					);
					builder.replace(currSel, addStr.slice(0, -1));
				}
			});
			break;
	}
}

/**
 * Select and instantiate the correct sequence factory for the given input.
 *
 * Returns a stop-immediately function when `input` is `undefined` (cancelled)
 * or when no valid input type can be detected.
 *
 * @param input - Raw user input string, or `undefined` when cancelled.
 * @param p - Shared command context.
 * @returns A per-index function `(i) => { stringFunction, stopFunction }`.
 */
function getSequenceFunction(
	input: string | undefined,
	p: TParameter,
): (i: number) => {
	stringFunction: string;
	stopFunction: boolean;
} {
	// if input was "undefined" (canceled), return stopFunction true
	if (input == null) {
		const retStr = { stringFunction: '', stopFunction: true };
		return (_) => retStr;
	}

	// determine input type (based on input string beginning)
	const inputType: TInput = getInputType(input, p);

	// return proper sequence function based on input type
	switch (inputType) {
		case 'decimal':
			return createDecimalSeq(input, p, 10); // decimal
		case 'hex':
			return createDecimalSeq(input, p, 16); // hex
		case 'octal':
			return createDecimalSeq(input, p, 8); // octal
		case 'binary':
			return createDecimalSeq(input, p, 2); // binary
		case 'alpha':
			return createStringSeq(input, p); // strings
		case 'date':
			return createDateSeq(input, p); // dates (future: also time?)
		case 'expression':
			return createExpressionSeq(input, p); // expressions
		case 'own':
			return createOwnSeq(input, p); // own (war "months" in version 0.x) - custom alphabetic sequences
		case 'predefined':
			return createPredefinedSeq(input, p); // predefined text sequences (predefined lists in configuration)
		case 'function':
			return createFunctionSeq(input, p); // predefined functions (predefined functions in configuration)
		case 'textSelected':
			return createTextSelectedSeq(input, p); // no input - just use the originally selected text
		case 'backtick':
			return createBacktickTemplateSeq(input, p);
		case 'template':
			return createTemplateSeq(input, p);
		default:
			const retStr = { stringFunction: '', stopFunction: true };
			return (_) => retStr; // no valid input type detected, stop function
	}
}

/**
 * Determine the {@link TInput} type from the beginning of the input string.
 *
 * Detection order (first match wins):
 * backtick → template → hex → octal → binary → decimal → expression → alpha → date → own → predefined → function → empty/default
 *
 * An empty input with pre-existing selected text resolves to `"textSelected"`;
 * an empty input without selected text defaults to `"decimal"`.
 *
 * @param input - Raw user input string.
 * @param p - Shared command context (provides compiled regex segments and config).
 * @returns The detected input type, or `null` when nothing matches.
 */
function getInputType(input: string, p: TParameter): TInput | null {
	let type: TInput = null;

	// get current alphabet from configuration
	const alphabet: string =
		p.config.get('alphabet') || 'abcdefghijklmnopqrstuvwxyz';

	// helper: regex-escape
	const escapeForRegex = (s: string) =>
		s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

	// define regex for alphabetic characters based on current alphabet (from configuration)
	const chars = Array.from(alphabet).map(escapeForRegex).join('');
	const reAlphabetCharClass = new RegExp(
		p.segments['charStartAlpha'] + '\\s*[' + chars + ']',
		'iu',
	);

	// What kind of input is it (check regex from begin)
	switch (true) {
		// backtick template: `prefix {sequence-def} suffix`
		case /^`/.test(input):
			type = 'backtick';
			break;
		// template: starts with a single or double quote
		case /^["']/.test(input):
			type = 'template';
			break;
		// hex numbers
		case /^(?:([x0\\s\\._])\1*)?[+-]?0x[0-9a-f]+/i.test(input):
			type = 'hex';
			break;
		// octal numbers
		case /^(?:([x0\\s\\._])\1*)?[+-]?0o[0-7]+/i.test(input):
			type = 'octal';
			break;
		// binary numbers
		case /^(?:([x0\\s\\._])\1*)?[+-]?0b[01]+/i.test(input):
			type = 'binary';
			break;
		// numbers (decimal)
		case /^(?:([x0\\s\\._])\1*)?[+-]?\d/i.test(input):
			type = 'decimal';
			break;
		// expression
		case new RegExp(p.segments['charStartExpressionfunction'], 'i').test(
			input,
		):
			type = 'expression';
			break;
		// strings (alphabetic)
		case reAlphabetCharClass.test(input):
			type = 'alpha';
			break;
		// date values
		case new RegExp(p.segments['charStartDate'], 'i').test(input):
			type = 'date';
			break;
		// own sequences
		case new RegExp(p.segments['charStartOwnSequence'], 'i').test(input):
			type = 'own';
			break;
		// predefined sequences
		case new RegExp(p.segments['charStartPredefinedSequence'], 'i').test(
			input,
		):
			type = 'predefined';
			break;
		// predefined functions
		case new RegExp(p.segments['charStartFunction'], 'i').test(input):
			type = 'function';
			break;
		// empty input (when input box is empty) - use selected text if available or decimal as default
		case /^$/i.test(input):
		default:
			const selectedText = p.origTextSel.join('');
			if (selectedText.length > 0) {
				type = 'textSelected';
			} else {
				type = 'decimal';
			}
	}

	return type;
}

/**
 * Build the sequence function for template inputs.
 *
 * The input begins with `"` or `'`, contains a template string with `{}`
 * placeholders, and ends with the closing quote. Everything after the closing
 * quote is treated as the inner sequence definition.
 *
 * - `{}` is replaced by the value produced by the inner sequence.
 * - `\{}` is an escaped literal `{}` and is not substituted.
 *
 * @example `"Item {}":1` → `Item 1`, `Item 2`, …
 * @example `'x={}, y={}':1:2` → two placeholders both filled by the same value
 *
 * @param input - Raw user input string (must start with `"` or `'`).
 * @param p - Shared command context.
 * @returns A per-index function `(i) => { stringFunction, stopFunction }`.
 */
function createTemplateSeq(
	input: string,
	p: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	const defaultReturn = { stringFunction: '', stopFunction: true };

	if (!input || input.length < 2) {
		return (_) => defaultReturn;
	}

	// which is the first char (" or ') - to find string ending
	const quoteChar = input[0];

	// find the closing (unescaped) quote
	const isEscapedAt = (pos: number): boolean => {
		let k = pos - 1;
		let count = 0;
		while (k >= 0 && input[k] === '\\') {
			count++;
			k--;
		}
		return count % 2 === 1;
	};

	let templateEnd = -1;
	for (let i = 1; i < input.length; i++) {
		if (input[i] === quoteChar && !isEscapedAt(i)) {
			templateEnd = i;
			break;
		}
	}

	if (templateEnd === -1) {
		return (_) => defaultReturn;
	}

	// unescape escaped quote chars inside the template
	const escRe = quoteChar === '"' ? /\\"/g : /\\'/g;
	const template = input.slice(1, templateEnd).replace(escRe, quoteChar);

	// everything after the closing quote is the inner sequence definition
	const seqDef = input.slice(templateEnd + 1).trim();

	// fall back to a plain incrementing decimal sequence when no definition given
	const innerSeqFunc = getSequenceFunction(
		seqDef.length > 0 ? seqDef : '1',
		p,
	);

	return (i) => {
		const inner = innerSeqFunc(i);
		if (inner.stopFunction) {
			return inner;
		}
		const out = template
			.replace(/(?<!\\)\{\}/g, inner.stringFunction)
			.replace(/\\\{\}/g, '{}');
		return { stringFunction: out, stopFunction: inner.stopFunction };
	};
}

/**
 * Build the sequence function for backtick template inputs.
 *
 * The input begins with `` ` ``, contains a template string, and optionally ends
 * with a closing `` ` ``. The sequence definition lives **inside** a `{…}` block
 * within the template; everything outside `{…}` is emitted verbatim.
 *
 * - Unescaped `{…}` → replaced by the value produced by the inner sequence.
 * - `\{` / `\}` → literal `{` / `}`.
 * - `` \` `` → literal backtick inside the template.
 * - Only the first `{…}` block is used (subsequent ones are left as-is).
 *
 * @example `` `Item {1:5}` `` → `Item 1`, `Item 2`, …, `Item 5`
 * @example `` `Row {a:e}: `` → `Row a: `, `Row b: `, …, `Row e: `
 *
 * @param input - Raw user input string (must start with `` ` ``).
 * @param p - Shared command context.
 * @returns A per-index function `(i) => { stringFunction, stopFunction }`.
 */
function createBacktickTemplateSeq(
	input: string,
	p: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	const defaultReturn = { stringFunction: '', stopFunction: true };

	if (!input || input.length < 2) {
		return (_) => defaultReturn;
	}

	// Count consecutive backslashes immediately before pos in str (escape detection)
	const countLeadingBackslashes = (str: string, pos: number): number => {
		let k = pos - 1;
		let count = 0;
		while (k >= 0 && str[k] === '\\') {
			count++;
			k--;
		}
		return count;
	};

	// Find the closing (unescaped) backtick
	let templateEnd = input.length;
	for (let i = 1; i < input.length; i++) {
		if (input[i] === '`' && countLeadingBackslashes(input, i) % 2 === 0) {
			templateEnd = i;
			break;
		}
	}

	// Template content sits between the two backticks
	const rawTemplate = input.slice(1, templateEnd);

	// Unescape backtick, { and } in static text segments
	const unescape = (s: string) =>
		s
			.replace(/\\`/g, '`')
			.replace(/\\\{/g, '{')
			.replace(/\\\}/g, '}')
			.replace(/\\\\/g, '\\');

	// Parse rawTemplate into alternating static/sequence segments
	type Segment =
		| { kind: 'static'; text: string }
		| {
				kind: 'seq';
				fn: (i: number) => {
					stringFunction: string;
					stopFunction: boolean;
				};
		  };
	const segments: Segment[] = [];

	let pos = 0;
	let staticStart = 0;
	let hasSeq = false;

	while (pos < rawTemplate.length) {
		if (
			rawTemplate[pos] === '{' &&
			countLeadingBackslashes(rawTemplate, pos) % 2 === 0
		) {
			// Flush static text accumulated so far
			if (pos > staticStart) {
				segments.push({
					kind: 'static',
					text: unescape(rawTemplate.slice(staticStart, pos)),
				});
			}
			// Find the matching closing }
			let braceEnd = rawTemplate.length;
			for (let j = pos + 1; j < rawTemplate.length; j++) {
				if (
					rawTemplate[j] === '}' &&
					countLeadingBackslashes(rawTemplate, j) % 2 === 0
				) {
					braceEnd = j;
					break;
				}
			}
			const seqDef = rawTemplate.slice(pos + 1, braceEnd).trim();
			segments.push({
				kind: 'seq',
				fn: getSequenceFunction(seqDef.length > 0 ? seqDef : '1', p),
			});
			hasSeq = true;
			pos = braceEnd + 1;
			staticStart = pos;
		} else {
			pos++;
		}
	}

	// Flush any trailing static text
	if (staticStart < rawTemplate.length) {
		segments.push({
			kind: 'static',
			text: unescape(rawTemplate.slice(staticStart)),
		});
	}

	if (!hasSeq) {
		return (_) => defaultReturn;
	}

	return (i) => {
		let result = '';
		for (const seg of segments) {
			if (seg.kind === 'static') {
				result += seg.text;
			} else {
				const inner = seg.fn(i);
				if (inner.stopFunction) {
					return { stringFunction: '', stopFunction: true };
				}
				result += inner.stringFunction;
			}
		}
		return { stringFunction: result, stopFunction: false };
	};
}

function createQuickPick(
	context: vscode.ExtensionContext,
	parameter: TParameter,
): vscode.QuickPick<
	vscode.QuickPickItem & {
		cmd: string;
	}
> {
	// build QuickPick items: top 'New sequence', then history newest-first
	const qp = vscode.window.createQuickPick<
		vscode.QuickPickItem & { cmd: string }
	>();

	const items: Array<
		vscode.QuickPickItem & {
			cmd: string;
			buttons?: vscode.QuickInputButton[];
		}
	> = [];
	items.push({
		label: '$(add) New sequence',
		description: 'Start a new sequence',
		cmd: '',
	});

	const maxHistoryItems =
		Number(parameter.config.get('maxHistoryItems')) || 100;

	// create items with a delete button each (trash icon)
	const history = getHistory(context) || [];
	for (const h of history) {
		if (items.length >= maxHistoryItems) {
			break;
		}
		items.push({
			label: h,
			description: '',
			cmd: h,
			buttons: [
				{
					iconPath: new vscode.ThemeIcon('edit'),
					tooltip: 'Edit this history entry',
				} as any,
				{
					iconPath: new vscode.ThemeIcon('trash'),
					tooltip: 'Delete this history entry',
				} as any,
			],
		});
	}

	qp.items = items;
	qp.placeholder = 'Choose "New sequence" or any of the last entries';
	qp.matchOnDescription = true;

	function schedulePreview(cmd: string | undefined) {
		if (!cmd) {
			// clear preview decorations
			if (previewDecorationType) {
				parameter.editor.setDecorations(previewDecorationType, []);
			}
		} else {
			// call preview
			try {
				insertNewSequence(cmd, parameter, 'preview');
			} catch (e) {
				printToConsole(
					'Function: schedulePreview - preview error: ' + e,
				);
			}
		}
	}

	qp.onDidChangeActive((activeItems) => {
		const active = activeItems[0];
		if (!active || !active.cmd) {
			schedulePreview(undefined);
			return;
		}
		schedulePreview(active.cmd);
	});

	// handle clicking the per-item buttons (delete / edit)
	qp.onDidTriggerItemButton(async (e) => {
		const item = e.item as vscode.QuickPickItem & { cmd?: string };
		if (!item || !item.cmd) {
			return;
		}
		const tooltip = (e.button && (e.button as any).tooltip) || '';
		if (tooltip === 'Delete this history entry') {
			// delete from storage
			await deleteFromHistory(context, item.cmd);
			// remove from quickpick items
			qp.items = qp.items.filter((i) => (i as any).cmd !== item.cmd);
			// clear preview if the deleted item was active
			const active = qp.activeItems[0];
			if (!active || !active.cmd) {
				schedulePreview(undefined);
			} else {
				schedulePreview(active.cmd);
			}
		} else if (tooltip === 'Edit this history entry') {
			// Hide quickpick and launch InsertSeqCommand with the selected history item
			qp.hide();
			await InsertSeqCommand(context, item.cmd);
		}
	});

	// add a toolbar Clear button to clear all history
	qp.buttons = [
		{
			iconPath: new vscode.ThemeIcon('trash'),
			tooltip: 'Clear all history',
		} as any,
	];
	qp.onDidTriggerButton(async (_) => {
		// Confirm
		const ans = await vscode.window.showWarningMessage(
			'Clear entire history?',
			{ modal: true },
			'Clear',
		);
		if (ans !== 'Clear') {
			return;
		}
		await clearHistory(context);
		// reset quickpick items to only New sequence
		qp.items = [
			{
				label: '$(add) New sequence',
				description: 'Start a new sequence',
				cmd: '',
			},
		];
		schedulePreview(undefined);
	});

	qp.onDidAccept(async () => {
		const chosen = qp.activeItems[0];
		if (!chosen) {
			qp.hide();
			return;
		}

		if (!chosen.cmd) {
			// New sequence selected -> delegate to InsertSeqCommand
			qp.hide();
			await InsertSeqCommand(context, '');
			return;
		}

		// history item selected -> final execution
		qp.busy = true;
		try {
			insertNewSequence(chosen.cmd, parameter, 'final');
			// save to history (will no-op if already present)
			await saveToHistory(context, chosen.cmd);
		} finally {
			qp.busy = false;
			qp.hide();
		}
	});
	qp.onDidHide(() => {
		// clear preview decorations
		if (previewDecorationType) {
			parameter.editor.setDecorations(previewDecorationType, []);
		}
		qp.dispose();
	});
	return qp;
}
