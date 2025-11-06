/*
The idea of the extension "InsertSeq" (previous InsertNums) based on the plugin insertnums 
for sublimecode from James Brooks
Original sublimecode extension: https://github.com/jbrooksuk/InsertNums

Version 1.0 is completely new written and additional features are added.

Volker Dobler
original from May 2020
rewritten November 2025
*/

const debug = true;

import * as vscode from 'vscode';
import { Temporal } from 'temporal-polyfill';

import * as formatting from './formatting';
import {
	getHistory,
	saveToHistory,
	clearHistory,
	deleteFromHistory,
} from './history';
declare const require: any;

function printToConsole(str: string): void {
	if (debug) console.log('Debugging: ' + str);
}

export function activate(context: vscode.ExtensionContext) {
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

	// Internal commands (not contributed in package.json) to allow keybindings while QuickPick is open
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'insertseq._history.deleteActive',
			async () => {
				const qp = currentHistoryQuickPick;
				if (!qp) return;
				const active = qp.activeItems[0] as
					| (vscode.QuickPickItem & { cmd?: string })
					| undefined;

				if (!active || !active.cmd) return;
				await deleteFromHistory(context, active.cmd);
				qp.items = qp.items.filter(
					(i) => (i as any).cmd !== active.cmd,
				);
			},
		),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(
			'insertseq._history.clearAll',
			async () => {
				const qp = currentHistoryQuickPick;
				// Confirm before clearing
				const ans = await vscode.window.showWarningMessage(
					'Clear entire sequence history?',
					{ modal: true },
					'Clear',
				);
				if (ans !== 'Clear') return;
				await clearHistory(context);
				if (qp)
					qp.items = [
						{
							label: '$(add) New sequence',
							description: 'Start a new sequence',
							cmd: '',
						},
					];
			},
		),
	);
}

export function deactivate() {}

const appName: string = 'insertseq';

interface RuleTemplate {
	[key: string]: string;
}

// Input type based on the beginning of the input string
type TInputType =
	| 'decimal'
	| 'hex'
	| 'octal'
	| 'binary'
	| 'alpha'
	| 'date'
	| 'expression'
	| 'own'
	| 'predefined'
	| 'textSelected'
	| null;

type TStatus = 'preview' | 'final';

// Parameter for the sequence creation functions
type TParameter = {
	editor: vscode.TextEditor;
	origCursorPos: vscode.Selection[];
	origTextSel: string[];
	segments: RuleTemplate;
	config: vscode.WorkspaceConfiguration;
};

// Special replacements within expressions
type TSpecialReplacementValues = {
	currentValueStr: string;
	valueAfterExpressionStr: string;
	previousValueStr: string;
	origTextStr: string;
	startStr: string;
	stepStr: string;
	numberOfSelectionsStr: string;
	currentIndexStr: string;
};

// Default configuration values (will be overwritten by user settings)
let previewDecorationType: vscode.TextEditorDecorationType | null = null;
// current shown history quickpick (if any) - used by delete/clear commands
let currentHistoryQuickPick: vscode.QuickPick<
	vscode.QuickPickItem & { cmd?: string }
> | null = null;

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

async function InsertSeqCommand(
	context: vscode.ExtensionContext,
	value: string,
) {
	// decimals: [<start>][:<step>][#<repeat>][*<frequency>][~<format>]r[+]<random>][::<expr>][@<stopexpr>][$][!]
	// alpha: <start>[:<step>][#<repeat>][\*<frequency>][~<format>][w][@<stopexpr>][$][!]
	// dates: %[<year>[-<month>[-<day>]]][:[dwmy]<step>][#<repeat>][*<frequency>][~<format>][$][!]
	// expressions: [<cast>]|[~<format>::]<expr>[@<stopexpr>][$][!]
	// own (war "months"): ;<start>[:<step>][#<repeat>][\*<frequency>][~<format>][@<stopexpr>][$][!]

	// get active editor
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showInformationMessage('No active editor!');
		return;
	}

	// read config file
	// config entries in appName overwrites same config entries in "insertnums"
	const config = Object.assign(
		{},
		vscode.workspace.getConfiguration(appName),
	);

	// read regular Expression for segmenting the input string
	const regexpInputSegments = getRegExpressions();

	// get current alphabet from configuration and replace placeholder in regex
	const currentAlphabet: string = config.get('alphabet') || '\u{0}';
	regexpInputSegments['start_alpha'] = regexpInputSegments[
		'start_alpha'
	].replace('\\w', `${currentAlphabet}`);

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

	// global parameter for sequence creation which will be passed to insertNewSequence()
	const parameter: TParameter = {
		editor: editor,
		origCursorPos: origCursorPositions,
		origTextSel: origTextSelections,
		segments: regexpInputSegments,
		config: config,
	};

	const inputOptions: vscode.InputBoxOptions = {
		placeHolder:
			'[<start>][:<step>][*<frequency>][#<repeat>][##startover][~<format>][;predefinedText|[<ownselection>]][r[+]<random>][::<expr>][@<stopexpr>][$][!]',
		value: value,
		validateInput: function (input) {
			insertNewSequence(input, parameter, 'preview');
			return '';
		},
	};

	vscode.window.showInputBox(inputOptions).then(function (
		input: string | undefined,
	) {
		insertNewSequence(input, parameter, 'final');
		saveToHistory(context, input);
	});
}

async function InsertSeqHistory(
	context: vscode.ExtensionContext,
	value: string,
) {
	// get active editor
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	const history = getHistory(context);

	if (history.length === 0) {
		InsertSeqCommand(context, '');
		return;
	}

	// read config file - insertnums as of history reason (extension previously was named insertnums) and 'appName' as of current config file.
	// config entries in appName overwrites same config entries in "insertnums"
	const config = Object.assign(
		{},
		vscode.workspace.getConfiguration(appName),
	);

	// read regular Expression for segmenting the input string
	const regexpInputSegments = getRegExpressions();

	// get current alphabet from configuration and replace placeholder in regex
	const currentAlphabet: string = config.get('alphabet') || '\u{0}';
	regexpInputSegments['start_alpha'] = regexpInputSegments[
		'start_alpha'
	].replace('\\w', `${currentAlphabet}`);

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

	// global parameter for sequence creation which will be passed to insertNewSequence()
	const parameter: TParameter = {
		editor: editor,
		origCursorPos: origCursorPositions,
		origTextSel: origTextSelections,
		segments: regexpInputSegments,
		config: config,
	};

	// build QuickPick items: top 'New sequence', then history newest-first
	const qp = vscode.window.createQuickPick<
		vscode.QuickPickItem & { cmd: string }
	>();
	// expose current quickpick so internal commands (DEL / CTRL+DEL) can access it
	currentHistoryQuickPick = qp;
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

	// create items with a delete button each (trash icon)
	for (const h of history) {
		items.push({
			label: h,
			description: '',
			cmd: h,
			buttons: [
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
			if (previewDecorationType)
				parameter.editor.setDecorations(previewDecorationType, []);
		} else {
			// call preview
			try {
				insertNewSequence(cmd, parameter, 'preview');
			} catch (e) {
				console.error('preview error', e);
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

	// handle clicking the per-item delete button
	qp.onDidTriggerItemButton(async (e) => {
		const item = e.item as vscode.QuickPickItem & { cmd?: string };
		if (!item || !item.cmd) return;
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
	});

	// add a toolbar Clear button to clear all history
	qp.buttons = [
		{
			iconPath: new vscode.ThemeIcon('trash'),
			tooltip: 'Clear all history',
		} as any,
	];
	qp.onDidTriggerButton(async (button) => {
		// Confirm
		const ans = await vscode.window.showWarningMessage(
			'Clear entire history?',
			{ modal: true },
			'Clear',
		);
		if (ans !== 'Clear') return;
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
		if (previewDecorationType)
			parameter.editor.setDecorations(previewDecorationType, []);
		qp.dispose();
		// clear global reference
		if (currentHistoryQuickPick === qp) currentHistoryQuickPick = null;
	});

	qp.show();
}

// Create new Sequence based on Input
function insertNewSequence(
	input: string | undefined, // der eingegebene Text
	parameter: TParameter,
	status: TStatus,
): void {
	// get current sequence function based on input type
	const currSeqFunction = getSequenceFunction(input, parameter);

	const sorted = input && input?.match(parameter.segments['outputSort']);
	const reverse = input && input?.match(parameter.segments['outputReverse']);

	// generate new sequence strings (up to stop expression or maxInsertions)
	const strList: string[] = [];
	for (
		let i = 0;
		i < (Number(parameter.config.get('maxInsertions')) || 1000);
		i++
	) {
		const res = currSeqFunction(i);
		if (res.stopFunction) break;
		strList.push(res.stringFunction);
	}

	const delimiter: string = parameter.config.get('delimiter') || '';
	const newLine: boolean = delimiter === '';
	const eolString =
		parameter.editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';

	// define preview decoration type if not yet done
	if (!previewDecorationType) {
		previewDecorationType = vscode.window.createTextEditorDecorationType({
			after: {
				color: parameter.config.previewColor,
				margin: '0 0 0 0',
			},
		});
	}
	parameter.editor.setDecorations(previewDecorationType, []);

	const insertCursorPos = sortSelectionsByPosition(
		parameter.origCursorPos,
		sorted ? true : false,
		reverse ? true : false,
	);

	switch (status) {
		case 'preview':
			// Vorschau mit Decorations
			const decorations: vscode.DecorationOptions[] = [];
			let addStr = '';

			// for each created string, create a decoration. If the number of created strings is higher than the number of original cursors, new lines will be inserted.
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
								contentText: str.replace(/\s/g, '\u00A0'),
							},
						},
					};
					decorations.push(decoration);
					addStr = str;
					// decorations are only visible in previous selected multi-cursors
					//
					//				} else {
					//					// insert additional decorations outside of selection
					//					const lastPos =
					//						parameter.origCursorPos[
					//							parameter.origCursorPos.length - 1
					//						];
					//					const addIndex = index - parameter.origCursorPos.length + 1;
					//
					//					if (newLine) {
					//						// insert decoration at new line as long as not end of document
					//						if (
					//							lastPos.start.line + addIndex <
					//							parameter.editor.document.lineCount
					//						) {
					//							let decoration = {
					//								range: new vscode.Range(
					//									lastPos.start.line + addIndex,
					//									0,
					//									lastPos.start.line + addIndex,
					//									0,
					//								),
					//								renderOptions: {
					//									after: {
					//										contentText: str.replace(
					//											/\s/g,
					//											'\u00A0',
					//										),
					//									},
					//								},
					//							};
					//							decorations.push(decoration);
					//						}
					//					} else {
					//						addStr += delimiter + str;
					//					}
				}
			});
			if (strList.length > insertCursorPos.length && !newLine) {
				const lastPos = insertCursorPos[insertCursorPos.length - 1];

				let decoration = {
					range: new vscode.Range(
						lastPos.start.line,
						0,
						lastPos.start.line,
						0,
					),
					renderOptions: {
						after: {
							contentText: addStr.replace(/\s/g, '\u00A0'),
						},
					},
				};
				decorations[decorations.length - 1] = decoration;
			}
			parameter.editor.setDecorations(previewDecorationType, decorations);
			break;
		case 'final':
			parameter.editor.setDecorations(previewDecorationType, []);
			try {
				previewDecorationType.dispose();
			} catch {}
			previewDecorationType = null;

			parameter.editor.edit((builder) => {
				let addStr = '';

				if (strList.length === 0) {
					parameter.origTextSel.map((s) => strList.push(s));
				}

				strList.forEach((str, index) => {
					// insert strings in original Selection
					const maxIndex = newLine
						? insertCursorPos.length
						: insertCursorPos.length - 1;
					if (index < maxIndex) {
						const currSel = new vscode.Selection(
							insertCursorPos[index].start.line,
							insertCursorPos[index].start.character,
							insertCursorPos[index].end.line,
							insertCursorPos[index].end.character,
						);
						builder.replace(currSel, str.replace(/\s/g, '\u00A0'));
					} else {
						// insert additional insertions as newlines
						if (newLine) {
							// insert decoration at new line as long as not end of document

							// at the end of document, insert additional lines
							const currSel = new vscode.Position(
								insertCursorPos[maxIndex - 1].start.line + 1,
								0,
							);
							// insert new line first if insert at last line of document
							if (
								currSel.line ===
								parameter.editor.document.lineCount
							) {
								builder.insert(
									currSel,
									eolString + str.replace(/\s/g, '\u00A0'),
								);
							} else {
								builder.insert(
									currSel,
									str.replace(/\s/g, '\u00A0') + eolString,
								);
							}
						} else {
							// insert additional strings with "delimiter"
							addStr += str + delimiter;
						}
					}
				});
				if (addStr.length > 0) {
					const lastPos = insertCursorPos[insertCursorPos.length - 1];
					const currSel = new vscode.Range(
						lastPos.start.line,
						lastPos.start.character,
						lastPos.end.line,
						lastPos.end.character,
					);
					builder.replace(
						currSel,
						addStr.slice(0, -1).replace(/\s/g, '\u00A0'),
					);
				}
			});
			break;
	}
}

function getSequenceFunction(
	input: string | undefined,
	p: TParameter,
): (i: number) => {
	stringFunction: string;
	stopFunction: boolean;
} {
	// bei "undefined" wurde die Eingabe abgebrochen - überschreibe die bisherig (temporären) Eingaben
	if (input == null) {
		const retStr = { stringFunction: '', stopFunction: true };
		return (i) => retStr;
	}

	const inputType: TInputType = getInputType(input, p);

	switch (inputType) {
		case 'decimal':
			return createDecimalSeq(input, p, 10);
		case 'hex':
			return createDecimalSeq(input, p, 16);
		case 'octal':
			return createDecimalSeq(input, p, 8);
		case 'binary':
			return createDecimalSeq(input, p, 2);
		case 'alpha':
			return createStringSeq(input, p);
		case 'date':
			return createDateSeq(input, p);
		case 'expression':
			return createExpressionSeq(input, p);
		case 'own':
			return createOwnSeq(input, p);
		case 'predefined':
			return createPredefinedSeq(input, p);
		case 'textSelected':
			return createTextSelectedSeq(input, p);
		default:
			const retStr = { stringFunction: '', stopFunction: true };
			return (i) => retStr;
	}
}

function getInputType(input: string, p: TParameter): TInputType | null {
	let type: TInputType = null;

	const alphabet: string = p.config.get('alphabet') || '';

	// helper: regex-escape
	const escapeForRegex = (s: string) =>
		s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

	// matcht, wenn das Input mit einem der Zeichen aus `alphabet` beginnt
	const chars = Array.from(alphabet).map(escapeForRegex).join('');
	const reAlphabetCharClass = new RegExp('^[' + chars + ']', 'iu');

	// What kind of input is it (check regex from begin)
	switch (true) {
		// Hexadezimale Zahl
		case /^(?:([x0\\s\\._])\1*)?[+-]?0x[0-9a-f]+/i.test(input):
			type = 'hex';
			break;
		// Oktal Zahl
		case /^(?:([x0\\s\\._])\1*)?[+-]?0o[0-7]+/i.test(input):
			type = 'octal';
			break;
		// binäre Zahl
		case /^(?:([x0\\s\\._])\1*)?[+-]?0b[01]+/i.test(input):
			type = 'binary';
			break;
		// nummerische Zahl oder "leer"
		case /^(?:([x0\\s\\._])\1*)?[+-]?\d/i.test(input):
			type = 'decimal';
			break;
		// Expression
		case /^\|/i.test(input):
			type = 'expression';
			break;
		// Alphabetische Zeichen
		case reAlphabetCharClass.test(input):
			type = 'alpha';
			break;
		// Datum
		case /^%/i.test(input):
			type = 'date';
			break;
		// eigene Sequenz
		case /^\[/i.test(input):
			type = 'own';
			break;
		case /^;/i.test(input):
			type = 'predefined';
			break;
		// kein Typ erkennbar, dann nehme ich Dezimal an, soland nichts markiert worden ist - sonst lass einfach die Markierung stehen
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

function createDecimalSeq(
	input: string,
	parameter: TParameter,
	base: number,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// rules: RuleTemplate, selections: vscode.Selection[], config: vscode.WorkspaceConfiguration, base: number): (i : number) => string {

	const start =
		Number(
			input.match(parameter.segments['start_decimal'])?.groups?.start ??
				parameter.config.get('start'),
		) ?? 1;
	const startDecimals =
		input.match(parameter.segments['start_decimal'])?.groups
			?.startDecimals || '';

	const steps =
		Number(
			input.match(parameter.segments['steps_decimal'])?.groups?.steps ??
				parameter.config.get('step'),
		) || 1;
	const repe =
		Number(
			input.match(parameter.segments['repetition'])?.groups?.repeat ??
				parameter.config.get('repetition'),
		) || Number.MAX_SAFE_INTEGER;
	const freq =
		Number(
			input.match(parameter.segments['frequency'])?.groups?.freq ??
				parameter.config.get('frequency'),
		) || 1;
	const startover =
		Number(
			input.match(parameter.segments['startover'])?.groups?.startover ??
				parameter.config.get('startover'),
		) || Number.MAX_SAFE_INTEGER;
	const stopexpr =
		input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ??
		'';
	const expr =
		input.match(parameter.segments['expression'])?.groups?.expr ?? '';
	const leadString = input.match(parameter.segments['start_decimal'])?.groups
		?.lead_string;

	const randomAvailable =
		input.match(parameter.segments['start_decimal'])?.groups
			?.rndAvailable || null;

	const randomNumber =
		Number(
			input.match(parameter.segments['start_decimal'])?.groups?.rndNumber,
		) || 0;
	const randomDecimal =
		input.match(parameter.segments['start_decimal'])?.groups?.rndDecimals ||
		'';

	const randomPlusMinus =
		input.match(parameter.segments['start_decimal'])?.groups
			?.rndPlusMinus || null;

	const basePrefix =
		base === 16 ? '#x' : base === 8 ? '#o' : base === 2 ? '#b' : null;
	const format = leadString
		? leadString[0] + '>' + input.length
		: (basePrefix ??
			input.match(parameter.segments['format_decimal'])?.groups
				?.format_decimal ??
			parameter.config.get('format') ??
			'');

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '',
		previousValueStr: '0',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
		currentIndexStr: '',
		origTextStr: '',
	};

	return (i) => {
		let value = start;

		if (randomAvailable) {
			// generate random number based on given input
			const maxNumber =
				randomPlusMinus !== null ? start + randomNumber : randomNumber;

			// generate random number between start and maxNumber
			if (start <= maxNumber) {
				value = Number(
					Number(
						start +
							Math.random() *
								(maxNumber -
									start +
									0.5 * 10 ** (-randomDecimal.length - 1)),
					).toFixed(randomDecimal.length),
				);
			}
		} else {
			// calculate current value based on start, step, frequency, repetition and startover
			value =
				start +
				steps * Math.trunc(((i % startover) % (freq * repe)) / freq);
		}

		if (i <= parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		}
		replacableValues.currentIndexStr = i.toString();
		replacableValues.currentValueStr = value.toString(base);

		// if expression exists, evaluate expression with current Value and replace newValue with result of expression.
		// if expression does not lead to a number, the current / new value will not be changed
		try {
			let exprResult = runExpression(
				replaceSpecialChars(expr, replacableValues),
			);
			if (Number.isFinite(exprResult)) value = Number(exprResult);
		} catch {
			// ignore errors in expression evaluation - keep current value;
		}

		replacableValues.valueAfterExpressionStr = value.toString(base);

		let stopExpressionTriggered = i >= parameter.origCursorPos.length;

		if (stopexpr.length > 0) {
			// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
			try {
				let stopExprResult = runExpression(
					replaceSpecialChars(stopexpr, replacableValues),
				);
				if (stopExprResult) {
					stopExprResult = Boolean(stopExprResult);
				} else {
					stopExprResult = i >= parameter.origCursorPos.length;
				}
			} catch {
				stopExpressionTriggered = i >= parameter.origCursorPos.length;
			}
		} else {
			stopExpressionTriggered = i >= parameter.origCursorPos.length;
		}

		replacableValues.previousValueStr = value.toString();

		// apply formatting if format string is given and return formatted value
		if (format !== '') {
			return {
				stringFunction: formatting.formatNumber(value, format),
				stopFunction: stopExpressionTriggered,
			};
		} else {
			if (startDecimals === '') {
				return {
					stringFunction: value.toString(base),
					stopFunction: stopExpressionTriggered,
				};
			} else {
				return {
					stringFunction: value.toFixed(startDecimals.length),
					stopFunction: stopExpressionTriggered,
				};
			}
		}
	};
}

function createStringSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// Unicode sichere Umwandlung von String zu Index
	function stringToIndex(str: string): number {
		const chars = Array.from(str); // Unicode-Graphem
		let index = 0;

		for (const ch of chars) {
			const charIndex = charToIndex.get(ch);
			if (charIndex === undefined) {
				throw new Error(`Char "${ch}" not in alphabet.`);
			}
			index = index * alphabetLen + charIndex;
		}

		// Alle Kombinationen kürzerer Länge berücksichtigen
		for (let len = 1; len < chars.length; len++) {
			index += Math.pow(alphabetLen, len);
		}

		return index;
	}

	function indexToString(index: number): string {
		if (index < 0) {
			throw new Error('Index below possible values!');
		}

		let length = 1;
		let count = 0;

		while (true) {
			const combinations = Math.pow(alphabetLen, length);
			if (index < count + combinations) break;
			count += combinations;
			length++;
		}

		index -= count;

		const chars: string[] = [];
		for (let i = 0; i < length; i++) {
			chars.unshift(alphabetArr[index % alphabetLen]);
			index = Math.floor(index / alphabetLen);
		}

		return chars.join('');
	}

	const startRegEx = new RegExp(parameter.segments['start_alpha'], 'i');

	const start = input.match(startRegEx)?.groups?.start || '';

	const defaultReturn = { stringFunction: '', stopFunction: true };
	if (start === '') return (i) => defaultReturn;

	const steps =
		Number(input.match(parameter.segments['steps_other'])?.groups?.steps) ||
		Number(parameter.config.get('step')) ||
		1;
	const repe =
		Number(input.match(parameter.segments['repetition'])?.groups?.repeat) ||
		Number(parameter.config.get('repetition')) ||
		Number.MAX_SAFE_INTEGER;
	const freq =
		Number(input.match(parameter.segments['frequency'])?.groups?.freq) ||
		Number(parameter.config.get('frequency')) ||
		1;
	const startover =
		Number(
			input.match(parameter.segments['startover'])?.groups?.startover,
		) ||
		Number(parameter.config.get('startover')) ||
		Number.MAX_SAFE_INTEGER;
	const stopexpr =
		input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ||
		'';
	const expr =
		input.match(parameter.segments['expression'])?.groups?.expr || '';
	const format =
		input.match(parameter.segments['format_alpha'])?.groups?.format_alpha ||
		'';
	// determine capitalization
	let capital: string = 'preserve';
	// check global configuration first
	switch (
		String(parameter.config.get('alphaCapital') || '').toLocaleLowerCase()
	) {
		case 'upper':
			capital = 'upper';
			break;
		case 'lower':
			capital = 'lower';
			break;
		case 'pascal':
			capital = 'pascal';
			break;
	}

	// then check input first character
	if (input && input[0].toUpperCase() === input[0]) {
		capital = 'upper';
	}

	// then check input capitalization options
	switch (
		String(
			input.match(startRegEx)?.groups?.alphacapital,
		).toLocaleLowerCase()
	) {
		case 'u':
			capital = 'upper';
			break;
		case 'l':
			capital = 'lower';
			break;
		case 'p':
			capital = 'pascal';
			break;
	}

	// support string or array in configuration
	const alphabetRaw =
		parameter.config.get('alphabet') || 'abcdefghijklmnopqrstuvwxyz';
	const alphabetArr: string[] = Array.isArray(alphabetRaw)
		? alphabetRaw.map(String)
		: Array.from(String(alphabetRaw));

	// Prüfung, ob alphabet Duplikate enthält
	const uniqAlphabet = new Set(alphabetArr);
	if (uniqAlphabet.size !== alphabetArr.length) {
		throw new Error('Alphabet includes invalid entries!');
	}

	const charToIndex = new Map<string, number>();
	// Build mapping that accepts both lower/upper input forms but keeps alphabetArr as canonical output values
	alphabetArr.forEach((char: string, i: number) => {
		charToIndex.set(char, i);
		const lower = char.toLowerCase();
		const upper = char.toUpperCase();
		if (!charToIndex.has(lower)) charToIndex.set(lower, i);
		if (!charToIndex.has(upper)) charToIndex.set(upper, i);
	});
	const alphabetLen = alphabetArr.length;

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '',
		previousValueStr: '',
		currentIndexStr: '',
		origTextStr: '',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
	};

	const currentIndex = stringToIndex(start);

	return (i) => {
		if (i <= parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		} else {
			replacableValues.origTextStr = '';
		}

		replacableValues.currentIndexStr = i.toString();

		let value = indexToString(
			currentIndex +
				steps * Math.trunc(((i % startover) % (freq * repe)) / freq),
		);

		replacableValues.currentValueStr = value;

		// if expression does not lead to a string, the current / new value will not be changed
		try {
			let tempValue = runExpression(
				replaceSpecialChars(expr, replacableValues),
			);
			if (typeof tempValue === 'string' || tempValue instanceof String) {
				value = String(tempValue);
			}
		} catch {}

		replacableValues.valueAfterExpressionStr = value;

		let stopExprResult = false;

		// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
		if (stopexpr.length > 0) {
			try {
				const exprResult = runExpression(
					replaceSpecialChars(stopexpr, replacableValues),
				);
				if (exprResult) {
					stopExprResult = Boolean(exprResult);
				} else {
					stopExprResult = i >= parameter.origCursorPos.length;
				}
			} catch {
				stopExprResult = i >= parameter.origCursorPos.length;
			}
		} else {
			stopExprResult = i >= parameter.origCursorPos.length;
		}

		replacableValues.previousValueStr = value;

		// change capitalization based on settings
		switch (capital) {
			case 'upper':
				value = value.toUpperCase();
				break;
			case 'lower':
				value = value.toLowerCase();
				break;
			case 'pascal':
				value =
					value.charAt(0).toUpperCase() +
					value.slice(1).toLowerCase();
				break;
			default:
				// preserve original capitalization
				for (let idx = value.length - 1; idx >= 0; idx--) {
					const ch = value.charAt(idx);
					const origCh = start.charAt(
						Math.max(0, start.length - value.length + idx),
					);
					if (origCh.toUpperCase() === origCh) {
						value =
							value.slice(0, idx) +
							ch.toUpperCase() +
							value.slice(idx + 1);
					} else {
						value =
							value.slice(0, idx) +
							ch.toLowerCase() +
							value.slice(idx + 1);
					}
				}
				break;
		}

		return {
			stringFunction: formatting.formatString(value, format),
			stopFunction: stopExprResult,
		};
	};
}

function createDateSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// if only "%" is given, use current date as start date
	if (input.match(/^%(?!\d)/)) {
		input = '%' + Temporal.Now.plainDateISO().toString() + input.slice(1);
	}
	// extract start date
	let start = input.match(parameter.segments['start_date'])?.groups?.start;

	// if start date is empty, use current date
	if (start === '') start = Temporal.Now.plainDateISO().toString();

	// if no start date found, return empty function
	const defaultReturn = { stringFunction: '', stopFunction: true };
	if (!start) return (i) => defaultReturn;

	const startGroups = input.match(parameter.segments['start_date'])?.groups;

	const dateParts = { year: 0, month: 0, day: 0 };

	if (startGroups?.datepart) {
		let yearStr =
			input.match(parameter.segments['start_date'])?.groups?.year ||
			Temporal.Now.plainDateISO().year.toString();
		if (yearStr.length === 2)
			yearStr = parameter.config.get('century') + yearStr;
		dateParts.year = Number(yearStr) || Temporal.Now.plainDateISO().year;
		dateParts.month =
			Number(
				input.match(parameter.segments['start_date'])?.groups?.month,
			) || Temporal.Now.plainDateISO().month;
		dateParts.day =
			Number(
				input.match(parameter.segments['start_date'])?.groups?.day,
			) || Temporal.Now.plainDateISO().day;
	} else {
		// currently no valie date input - might change in the future
		vscode.window.showInformationMessage('No date found!');
		return (i) => defaultReturn;
	}

	const steps =
		Number(input.match(parameter.segments['steps_date'])?.groups?.steps) ||
		Number(parameter.config.get('step')) ||
		1;
	const unit =
		input.match(parameter.segments['steps_date'])?.groups?.date_unit ||
		parameter.config.get('date_unit') ||
		'd';
	const repe =
		Number(input.match(parameter.segments['repetition'])?.groups?.repeat) ||
		Number(parameter.config.get('repetition')) ||
		Number.MAX_SAFE_INTEGER;
	const freq =
		Number(input.match(parameter.segments['frequency'])?.groups?.freq) ||
		Number(parameter.config.get('frequency')) ||
		1;
	const startover =
		Number(
			input.match(parameter.segments['startover'])?.groups?.startover,
		) ||
		Number(parameter.config.get('startover')) ||
		Number.MAX_SAFE_INTEGER;
	const stopexpr =
		input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ||
		'';
	const format =
		input.match(parameter.segments['format_date'])?.groups?.dateformat ||
		parameter.config.get('format') ||
		'';
	const language =
		input.match(parameter.segments['format_date'])?.groups?.language ||
		parameter.config.get('language') ||
		undefined;

	const instant = Temporal.PlainDateTime.from({
		year: dateParts.year,
		month: dateParts.month,
		day: dateParts.day,
		hour: 0,
		minute: 0,
		second: 0,
		millisecond: 0,
		microsecond: 0,
		nanosecond: 0,
	});

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '',
		previousValueStr: '',
		currentIndexStr: '',
		origTextStr: '',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
	};

	return (i) => {
		function calculateDateOffset(
			baseDate: Temporal.PlainDateTime,
			offset: number,
		): Temporal.PlainDateTime {
			let idx =
				steps *
				Math.trunc(((offset % startover) % (freq * repe)) / freq);

			let value: Temporal.PlainDateTime;
			if (idx >= 0) {
				switch (unit.toLowerCase()) {
					case 'w':
						value = baseDate.add({ weeks: idx });
						break;
					case 'm':
						value = baseDate.add({ months: idx });
						break;
					case 'y':
						value = baseDate.add({ years: idx });
						break;
					default:
						value = baseDate.add({ days: idx });
						break;
				}
			} else {
				switch (unit.toLowerCase()) {
					case 'w':
						value = baseDate.subtract({
							weeks: Math.abs(idx),
						});
						break;
					case 'm':
						value = baseDate.subtract({
							months: Math.abs(idx),
						});
						break;
					case 'y':
						value = baseDate.subtract({
							years: Math.abs(idx),
						});
						break;
					default:
						value = baseDate.subtract({
							days: Math.abs(idx),
						});
						break;
				}
			}

			return value;
		}

		if (i <= parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		} else {
			replacableValues.origTextStr = '';
		}
		replacableValues.currentIndexStr = i.toString();

		let value = calculateDateOffset(instant, i);

		replacableValues.currentValueStr = value
			.toPlainDate()
			.toLocaleString(language);

		let stopExprResult = false;
		// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
		if (stopexpr.length > 0) {
			try {
				const exprResult = runExpression(
					replaceSpecialChars(stopexpr, replacableValues),
				);
				if (exprResult) {
					stopExprResult = Boolean(exprResult);
				} else {
					stopExprResult = i >= parameter.origCursorPos.length;
				}
			} catch {
				stopExprResult = i >= parameter.origCursorPos.length;
			}
		} else {
			stopExprResult = i >= parameter.origCursorPos.length;
		}

		replacableValues.previousValueStr = value
			.toPlainDate()
			.toLocaleString(language);

		return {
			stringFunction: formatting.formatTemporalDateTime(
				value,
				format,
				language,
			),
			stopFunction: stopExprResult,
		};
	};
}

function createExpressionSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// const retFunction = { stringFunction: '', stopFunction: true };
	// return (i) => retFunction;

	const expr =
		input.match(parameter.segments['start_expression'])?.groups?.start ||
		'';
	const stopexpr =
		input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ||
		'';

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '', // only for stopexpression
		previousValueStr: '',
		currentIndexStr: '',
		origTextStr: '',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
	};

	// return function for each index/item
	return (i) => {
		if (i <= parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
			// set current value to original selection text for use in expression
			replacableValues.currentValueStr = parameter.origTextSel[i];
		}

		replacableValues.currentIndexStr = i.toString();

		try {
			const exprResult = runExpression(
				replaceSpecialChars(expr, replacableValues),
			);
			if (
				typeof exprResult === 'string' ||
				exprResult instanceof String
			) {
				replacableValues.currentValueStr = String(exprResult);
			} else if (typeof exprResult === 'number') {
				replacableValues.currentValueStr = exprResult.toString();
			} else {
				replacableValues.currentValueStr = '';
			}
		} catch {
			replacableValues.currentValueStr = '';
		}

		let stopExprResult = false;

		// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
		if (stopexpr.length > 0) {
			try {
				let stopExprResult = runExpression(
					replaceSpecialChars(stopexpr, replacableValues),
				);
				if (stopExprResult) {
					stopExprResult = Boolean(stopExprResult);
				} else {
					stopExprResult = i >= parameter.origCursorPos.length;
				}
			} catch {
				stopExprResult = i >= parameter.origCursorPos.length;
			}
		} else {
			stopExprResult = i >= parameter.origCursorPos.length;
		}

		replacableValues.previousValueStr = replacableValues.currentValueStr;

		return {
			stringFunction: replacableValues.currentValueStr,
			stopFunction: stopExprResult,
		};
	};
}

// Create own sequence base on direct input
function createOwnSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	const sequenceSet =
		input.match(parameter.segments['start_own'])?.groups?.ownseq || '';

	const start =
		parseInt(
			input.match(parameter.segments['start_own'])?.groups?.startseq ||
				'1',
		) || 1;
	const steps =
		Number(input.match(parameter.segments['steps_other'])?.groups?.steps) ||
		Number(parameter.config.get('step')) ||
		1;
	const repe =
		Number(
			input.match(parameter.segments['repetition'])?.groups?.repeat ??
				parameter.config.get('repetition'),
		) || Number.MAX_SAFE_INTEGER;
	const freq =
		Number(
			input.match(parameter.segments['frequency'])?.groups?.freq ??
				parameter.config.get('frequency'),
		) || 1;
	const startover =
		Number(
			input.match(parameter.segments['startover'])?.groups?.startover ??
				parameter.config.get('startover'),
		) || Number.MAX_SAFE_INTEGER;

	let ownSeq: string[] = [];

	if (sequenceSet.length > 0) {
		ownSeq = sequenceSet
			.split(/\s*[;,]\s*/) // Split an Komma oder Semikolon mit optionalen Leerzeichen davor und danach
			.filter(Boolean); // Entfernt leere Strings, falls vorhanden
	}

	return (i) => {
		if (ownSeq.length === 0) {
			return { stringFunction: '', stopFunction: true };
		} else {
			return {
				stringFunction:
					ownSeq[
						(start -
							1 +
							steps *
								Math.trunc(
									((i % startover) % (freq * repe)) / freq,
								)) %
							ownSeq.length
					] || '',
				stopFunction: i >= parameter.origCursorPos.length,
			};
		}
	};
}

function createPredefinedSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	type StartsOptions = {
		/** Case-insensitive comparison (default: false) */
		ignoreCase?: boolean;
		/** Wenn true, gilt '' (leerer x) als Match für den ersten Eintrag; default: false ('' -> kein Match) */
		emptyMatchesAll?: boolean;
		fullMatch?: boolean;
		startsWith?: boolean;
	};

	function arrayIncludesString(
		x: string,
		a: string[],
		options?: StartsOptions,
	): number {
		const {
			ignoreCase = false,
			emptyMatchesAll = false,
			fullMatch = false,
			startsWith = false,
		} = options || {};

		if (x == null) return -1;
		if (x.length === 0 && !emptyMatchesAll) return -1;

		switch (true) {
			case fullMatch && ignoreCase:
				return a.findIndex(
					(s) => s.toLocaleLowerCase() === x.toLocaleLowerCase(),
				);
			case ignoreCase:
				return a.findIndex((s) =>
					s.toLocaleLowerCase().startsWith(x.toLocaleLowerCase()),
				);
			case fullMatch:
				return a.findIndex((s) => s === x);
			case startsWith:
				return a.findIndex((s) => s.startsWith(x));
			default:
				return a.findIndex((s) => s.includes(x));
		}
	}

	const ownSequences: string[][] = parameter.config.get('ownsequences') || [
		[],
	];

	const sequenceText =
		input.match(parameter.segments['start_predefined'])?.groups
			?.start_predefined || '';
	const sequenceOptions =
		input.match(parameter.segments['start_predefined'])?.groups
			?.predefinedopts || '';

	const searchOptions: StartsOptions = {
		ignoreCase: sequenceOptions.toLocaleLowerCase().indexOf('i') > -1,
		fullMatch: sequenceOptions.toLocaleLowerCase().indexOf('f') > -1,
		startsWith: sequenceOptions.toLocaleLowerCase().indexOf('s') > -1,
	};

	const parseDigits = sequenceOptions.match(/(\d+)(?:\|(\d+)?)?/);

	const sequenceNumber = parseInt(
		parseDigits && parseDigits.length > 0 ? parseDigits[1] : '0',
	);

	const sequenceStart =
		parseInt(
			parseDigits && parseDigits.length > 1 ? parseDigits[2] : '1',
		) || 1;

	let ownSeq: string[] = [];
	let start = 0;

	const steps =
		Number(input.match(parameter.segments['steps_other'])?.groups?.steps) ||
		Number(parameter.config.get('step')) ||
		1;
	const repe =
		Number(
			input.match(parameter.segments['repetition'])?.groups?.repeat ??
				parameter.config.get('repetition'),
		) || Number.MAX_SAFE_INTEGER;
	const freq =
		Number(
			input.match(parameter.segments['frequency'])?.groups?.freq ??
				parameter.config.get('frequency'),
		) || 1;
	const startover =
		Number(
			input.match(parameter.segments['startover'])?.groups?.startover ??
				parameter.config.get('startover'),
		) || Number.MAX_SAFE_INTEGER;

	if (sequenceText.length > 0) {
		if (sequenceNumber >= 1 && sequenceNumber <= ownSequences.length) {
			let index = arrayIncludesString(
				sequenceText,
				ownSequences[sequenceNumber - 1],
				searchOptions,
			);
			if (index > -1) {
				ownSeq = ownSequences[sequenceNumber - 1];
				start = index;
			}
		} else {
			for (let i = 0; i < ownSequences.length; i++) {
				let l = arrayIncludesString(
					sequenceText,
					ownSequences[i],
					searchOptions,
				);
				if (l > -1) {
					ownSeq = ownSequences[i];
					start = l;
					break;
				}
			}
		}
	} else {
		if (sequenceNumber >= 1 && sequenceNumber <= ownSequences.length) {
			ownSeq = ownSequences[sequenceNumber - 1];
			start = (sequenceStart - 1) % ownSeq.length;
		}
	}

	return (i) => {
		if (ownSeq.length === 0) {
			return { stringFunction: '', stopFunction: true };
		} else {
			return {
				stringFunction:
					ownSeq[
						(start +
							steps *
								Math.trunc(
									((i % startover) % (freq * repe)) / freq,
								)) %
							ownSeq.length
					] || '',
				stopFunction: i >= parameter.origCursorPos.length,
			};
		}
	};
}

function createTextSelectedSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	return (i) => {
		return {
			stringFunction: parameter.origTextSel[i] || '',
			stopFunction: i >= parameter.origCursorPos.length,
		};
	};
}

function replaceSpecialChars(
	st: string,
	para: TSpecialReplacementValues,
): string {
	// _ ::= current value (before expression)
	// o ::= original text under current selection
	// c ::= current value (only for stopexpression, includes value after expression)
	// p ::= previous value
	// a ::= value of <start>
	// s ::= value of <step>
	// n ::= number of selections
	// i ::= counter, starting with 0 and increasing with each insertion

	return st
		.replace(/\b_\b/gi, para.currentValueStr)
		.replace(/\bo\b/gi, para.origTextStr)
		.replace(/\bc\b/gi, para.valueAfterExpressionStr)
		.replace(/\bp\b/gi, para.previousValueStr)
		.replace(/\ba\b/gi, para.startStr)
		.replace(/\bs\b/gi, para.stepStr)
		.replace(/\bn\b/gi, para.numberOfSelectionsStr)
		.replace(/\bi\b/gi, para.currentIndexStr);
}

function runExpression(str: string): any {
	// strip surrounding quotes
	if (str[0] === '"' && str[str.length - 1] === '"') {
		str = str.slice(1, -1);
	}
	if (str[0] === "'" && str[str.length - 1] === "'") {
		str = str.slice(1, -1);
	}

	try {
		let res: any;
		try {
			// dynamically require the safeEval helper if available
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const se = require('./safeEval');
			res = se.safeEvaluate ? se.safeEvaluate(str, 1000) : null;
		} catch {
			res = null;
		}

		if (res && typeof res === 'object') {
			if (!res.ok) return null;
			return res.value;
		}
		// // fallback to eval if safeEvaluate not available
		// const result = eval(str);
		// return result;
		return null;
	} catch {
		return null;
	}
}

// Get regular expressions for segmenting the input string
function getRegExpressions(): RuleTemplate {
	const matchRule: RuleTemplate = {
		start_decimal: '', // start Wert bei Zahlen
		start_alpha: '', // Start-Wert bei Buchstaben
		start_date: '', // Start-Wert bei Datumseingabe
		start_own: '', // Start-Wert bei eigenen Listen (string)
		start_predefined: '', // Start-Wert in der Configuration vordefinierte Listen (string)
		start_expression: '', // Start-Wert bei Ausdrücken
		steps_decimal: '', // Schritte bei Zahlen (auch mit Nachkommastellen möglich)
		steps_date: '', // Schritte bei einem Datum (es wird d, w, m oder y nach einer Zahl geschrieben, um zu sagen, welche Einheit die Steps sind)
		steps_other: '', // Schritte bei anderen Typen (nur Ganzzahl-Schritte)
		format_decimal: '', // Formatierung der Zahlen
		format_alpha: '',
		format_date: '',
		language: '',
		repetition: '',
		frequency: '',
		startover: '', // startet von vorne, unabhängig von repetition und frequency
		expression: '',
		stopexpression: '',
		outputSort: '',
		outputReverse: '',
	};

	// String-Eingabe: (?:"(?:(?:(?<!\\\\)\\\\")|[^"])+")
	// String-Eingabe: (?:\'(?:(?:(?<!\\\\)\\\\\')|[^\'])+\')
	// Klammer-Eingabe: (?:\\((?:(?:(?<!\\\\)\\\\\\))|[^)])+\\))

	// Special Chars in Expressions:
	// _ ::= current value (before expression or value under current selection)
	// s ::= value of <step>
	// n ::= number of selections
	// p ::= previous value se(last inserted)
	// c ::= current value (only within expressions, includes value after expression)
	// a ::= value of <start>
	// i ::= counter, starting with 0 and increasing with each insertion
	const ruleTemplate: RuleTemplate = {};
	ruleTemplate.charStartDate = `%`;
	ruleTemplate.charStartOwnSequence = `\\[`;
	ruleTemplate.charStartPredefinedSequence = `;`;
	ruleTemplate.charStartExpr = `\\|`;
	ruleTemplate.charStartSteps = `:`;
	ruleTemplate.charStartFormat = `~`;
	ruleTemplate.charStartFrequency = `\\*`;
	ruleTemplate.charStartRepetition = `#`;
	ruleTemplate.charStartStartover = `##`;
	ruleTemplate.charStartExpression = `::`;
	ruleTemplate.charStartStopExpression = `@`;
	// optional information after charStartOptions
	ruleTemplate.charStartOptions = `\\?`;
	ruleTemplate.specialchars = `(?:[_epasni])`;
	ruleTemplate.dateunits = `(?:[dDwWmMyY])`;
	ruleTemplate.predefinedoptions = `(?: [ifsIFS]+ )`;
	ruleTemplate.alphacapitalchars = `(?: [uUlLpP]? )`;
	// all Rules including sub-rules
	ruleTemplate.doublestring = `(?:"
									(?:
										(?:
											(?<!\\\\) \\\\"
										)
										|[^"]
									)+" 
								)`;
	ruleTemplate.singlestring = `(?:\'
									(?:
										(?:
											(?<!\\\\)\\\\\'
										)
										|[^\']
									)+\'
								)`;
	ruleTemplate.bracketedexpression = `(?:\\(
											(?:
												(?:
													(?<!\\\\)\\\\\\)
												)
												|[^)]
											)+\\)
										)`;
	ruleTemplate.leadchars = `[0x\\s\\._]`;
	ruleTemplate.delimiterChars = `{{charStartSteps}} {{charStartFormat}} {{charStartRepetition}} {{charStartFrequency}} {{charStartOwnSequence}} {{charStartStopExpression}} $ !`;
	ruleTemplate.delimiter = `(?:\\s*(?:[ {{delimiterChars}} ] | $))`;
	ruleTemplate.integer = `(?:[1-9]\\d*|0)`;
	ruleTemplate.pointfloat = `(?: (?: [1-9]\\d*|0 )? \\. (?<startDecimals> \\d+ ) )`;
	ruleTemplate.exponentfloat = `(?:(?:{{integer}} | {{pointfloat}}) [e] [+-]? \\d+)`;
	ruleTemplate.float = `(?:{{pointfloat}} | {{exponentfloat}})`;
	ruleTemplate.hexNum = `(?:0[x](?<hex>0|[1-9a-f][0-9a-f]*))`;
	ruleTemplate.octNum = `(?:0[o](?<oct>0|[1-7][0-7]*))`;
	ruleTemplate.binNum = `(?:0[b](?<bin>[01]+))`;
	ruleTemplate.numeric = `(?:(?<int>{{integer}}) | (?<float>{{float}}))`;
	ruleTemplate.exprtoken = `(?: 
								\\s*\\b
								(?:
									(?: [+-]?
										(?: {{integer}} | {{float}} )
									)
									| {{specialchars}}
								)
								\\b\\s*
							)`;
	ruleTemplate.exproperator = `(?: \\s* (?:\\+|-|\\*|\\/|\\*\\*|mod|div) \\s* )`;
	ruleTemplate.exprcompare = `(?:<=|<|>=|>|===|==)`;
	ruleTemplate.random = `(?: 
								(?:
									(?<rndAvailable> [rR])
									\\s*
									(?:
										(?<rndPlusMinus> [+-])?
										(?<rndNumber> \\d+
											(?:
												\\.
												(?<rndDecimals> \\d+)
											)?
										)
									)?
								)
							)`;
	ruleTemplate.language = `(?:
								lang:
								(?<language> \\w{2,3}
									(?: -\\w{2,3})?
								)
							)`;
	ruleTemplate.signedInt = `(?<int>[+-]? {{integer}})`;
	ruleTemplate.signedNum = `(?:[+-]? (?:{{numeric}} | {{hexNum}} | {{octNum}} | {{binNum}}))`;
	ruleTemplate.start_decimal = `^(?:
									(?<lead_string>
										(?<lead_char> {{leadchars}})
										\\k<lead_char>*
									)?
									(?<start>
										(?:{{signedNum}})
									)
									(?: {{random}} )?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.start_alpha = `^(?:
									(?<start> [\\w]+ )
									(?:
										{{charStartOptions}}
										(?<alphacapital> {{alphacapitalchars}} )
									)?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.start_date = `^(?:
									(?: {{charStartDate}} )
									\\s*
									(?<start>
										(?<datepart>
											(?<year> \\d{2}|\\d{4} )
											(?:
												(?:-
													(?<month> 0?[1-9]|10|11|12 )
												)
												(?:-
													(?<day> 0?[1-9]|[12][0-9]|30|31 )
												)?
											)?
										)
										|
										(?<fulldate>
											.+?
											| ".+"
											| '.+'
										)
										(?![\\d-])
									)?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.start_expression = `^(?:
										(?:{{charStartExpr}})
										\\s*
										(?<start>.+?)
										(?= {{delimiter}} )
									)`;
	ruleTemplate.start_own = `^(?: 
								\\[
								(?<ownseq> 
									(?:
										(?:
											(?<!\\\\)
											\\\\\\]
										)
										|
										[^\\]]
									)*
								)
								\\]
								(?:
									{{charStartOptions}}
									\\s*
									(?<startseq>
										\\d+
									)?
								)?
								(?= {{delimiter}} )
							)`;
	ruleTemplate.start_predefined = `^(?: 
								( {{charStartPredefinedSequence}} )
								\\s*
								(?<start_predefined>
									{{doublestring}}
									|
									{{singlestring}}
									|
									\\w+
								)?
								(?:
									{{charStartOptions}}
									\\s*
									(?<predefinedopts>
										(?:
											(?:
												\\d+
												(?:
													\\|
													(?: \\d+)?
												)?
											)
											\\s*
											{{predefinedoptions}}
										)
										|
										(?:
											{{predefinedoptions}}
											\\s*
											(?:
												\\d+
												(?:
													\\|
													(?: \\d+)?
												)?
											)
										)
										|
										(?:
											{{predefinedoptions}}
										)
										|
										(?:
											\\d+
												(?:
													\\|
													(?: \\d+)?
												)?
										)
									)?
								)?
								(?= {{delimiter}} )
							)`;
	ruleTemplate.steps_decimal = `(?:(?<!{{charStartSteps}})(?:{{charStartSteps}}) \\s* (?<steps> {{signedNum}}) (?= {{delimiter}} ))`;
	ruleTemplate.steps_date = `(?:
									(?<!{{charStartSteps}})
									(?:{{charStartSteps}})
									(?<steps> {{signedNum}})?
									\\s*
									(?<date_unit> {{dateunits}} )?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.steps_other = `(?:(?<!{{charStartSteps}})(?:{{charStartSteps}}) \\s* (?<steps> {{signedInt}}) (?= {{delimiter}} ))`;
	ruleTemplate.format_decimal = `(?: {{charStartFormat}} (?<format_decimal> (?<padding> {{leadchars}} )? (?<align> [<>^=] )? (?<sign> [ +-] )? (?<length> \\d+ ) (?<precision>\\.\\d+)? (?<type>[bcdeEfFgGnoxX%])? ) (?= {{delimiter}} ) )`;
	ruleTemplate.format_alpha = `(?: {{charStartFormat}} (?<format_alpha> (?<padding> {{leadchars}} )? (?<align> [<>^=] )? (?<length> \\d+ ) ) (?= {{delimiter}} ) )`;
	ruleTemplate.format_date = `(?: 
									{{charStartFormat}}
									(?:
										(?: {{language}} )
										\\s*
									)?
									(?<dateformat>
										(?:
											{{doublestring}}
											| {{singlestring}}
											| {{bracketedexpression}}
											| .+?
										)
									)?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.frequency = `(?:(?:{{charStartFrequency}}) \\s* (?<freq> \\d+) (?= {{delimiter}} ))`;
	ruleTemplate.repetition = `(?:(?<!{{charStartRepetition}})(?: {{charStartRepetition}}) \\s* (?<repeat> \\d+ ) (?= {{delimiter}} ))`;
	ruleTemplate.startover = `(?:(?:{{charStartStartover}}) \\s* (?<startover> \\d+) (?= {{delimiter}} ))`;
	ruleTemplate.expression = `(?: {{charStartExpression}} \\s* 
								(?<expr>
									{{doublestring}}
									| {{singlestring}}
									| {{bracketedexpression}}
									| .+?
								)
								(?= {{delimiter}} )
							)`;
	ruleTemplate.stopexpression = `(?: {{charStartStopExpression}} \\s* 
									(?<stopexpr>
										{{doublestring}}
										| {{singlestring}}
										| {{bracketedexpression}}
										| [^ {{delimiterChars}} ]+
									)
									(?= {{delimiter}} )
								)`;
	ruleTemplate.outputSort = `\\$!? $`;
	ruleTemplate.outputReverse = `!\\$? $`;

	for (let [key, value] of Object.entries(ruleTemplate)) {
		while (value.indexOf('{{') > -1) {
			const start: number = value.indexOf('{{');
			const ende: number = value.indexOf('}}', start + 2) + 2;
			const replace: string = value.slice(start, ende);
			const rule: string = replace.slice(2, replace.length - 2);
			if (rule in ruleTemplate) {
				value = value.replace(replace, ruleTemplate[rule]);
			} else {
				value = value.replace(replace, '§NIX§');
			}
		}
		if (key in matchRule) {
			matchRule[key] = value.replace(/\s/gi, '');
		}
	}

	return matchRule;
}
