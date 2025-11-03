/*
The idea of the extension "InsertSeq" (previous InsertNums) based on the plugin insertnums 
for sublimecode from James Brooks
Original sublimecode extension: https://github.com/jbrooksuk/InsertNums

Version 1.0 is completely new written and additional features are added.

Volker Dobler
original from May 2020
rewritten August 2025
*/

const debug = true;

import * as vscode from 'vscode';
// import * as assert from 'assert';
import { Temporal } from 'temporal-polyfill';
import * as formatting from './formatting';

function printToConsole(str: string): void {
	if (debug) console.log('Debugging: ' + str);
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'extension.insertseq',
			(value: string) => {
				const editor = vscode.window.activeTextEditor;
				if (!editor) {
					return;
				}

				InsertSeqCommand(context, value);
				printToConsole(
					'Congratulations, extension "insertseq" is now active!',
				);
			},
		),
	);
}

export function deactivate() {}

const appName: string = 'insertseq';
const maxIterations = 1000000;

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
	| null;

// Parameter for the sequence creation functions
type TParameter = {
	origCursorPos: vscode.Selection[];
	origTextSel: string[];
	segments: RuleTemplate;
	config: vscode.WorkspaceConfiguration;
};

// Special replacements within expressions
type TSpecialReplacementValues = {
	origTextStr: string;
	currentValueStr: string;
	previousValueStr: string;
	startStr: string;
	stepStr: string;
	numberOfSelectionsStr: string;
	currentIndexStr: string;
};

// Default configuration values (will be overwritten by user settings)
let previewDecorationType: vscode.TextEditorDecorationType | null = null;

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

	// start with current selected Text which will be overwritten
	let currentSelection: string[] | null = origTextSelections;

	const inputOptions: vscode.InputBoxOptions = {
		placeHolder:
			'[<start>][:<step>][#<repetition>][*<frequency>][~<format>][[<ownselection>]][r[+]<random>][::<expr>][@<stopexpr>][$][!]',
		validateInput: function (input) {
			currentSelection = insertNewSequence(
				editor,
				input,
				currentSelection,
				{
					origCursorPos: origCursorPositions,
					origTextSel: origTextSelections,
					segments: regexpInputSegments,
					config: config,
				},
				'preview',
			);
			return '';
		},
	};

	vscode.window.showInputBox(inputOptions).then(function (
		input: string | undefined,
	) {
		currentSelection = insertNewSequence(
			editor,
			input,
			currentSelection,
			{
				origCursorPos: origCursorPositions,
				origTextSel: origTextSelections,
				segments: regexpInputSegments,
				config: config,
			},
			'final',
		);
	});
}

// Create new Sequence based on Input
function insertNewSequence(
	editor: vscode.TextEditor,
	input: string | undefined, // der eingegebene Text
	currentSelection: string[] | null,
	parameter: TParameter,
	status: 'preview' | 'final' = 'final',
): string[] | null {
	const currSeqFunction = getSequenceFunction(input, parameter);

	const strList: string[] = [];

	for (let i = 0; i < maxIterations; i++) {
		const res = currSeqFunction(i);
		if (res.stopFunction) break;
		strList.push(res.stringFunction);
	}

	// Verwende die gemeinsame previewDecorationType statt bei jeder Aufruf eine neue zu erstellen
	if (!previewDecorationType) {
		previewDecorationType = vscode.window.createTextEditorDecorationType({
			after: { color: parameter.config.previewColor, margin: '0 0 0 0' },
		});
	}

	editor.setDecorations(previewDecorationType, []);

	switch (status) {
		case 'preview':
			// Vorschau mit Decorations
			const decorations: vscode.DecorationOptions[] = [];
			editor.edit(
				function (builder) {
					currentSelection &&
						currentSelection.forEach(
							function (selection, index, selections) {
								if (index >= strList.length) return;

								let decoration: vscode.DecorationOptions = {
									range: new vscode.Range(
										parameter.origCursorPos[
											index
										].anchor.line,
										parameter.origCursorPos[index].anchor
											.character -
											parameter.origTextSel[index].length,
										parameter.origCursorPos[
											index
										].active.line,
										parameter.origCursorPos[
											index
										].active.character,
									),
									renderOptions: {
										after: {
											contentText: strList[index].replace(
												/\s/g,
												'\u00A0',
											),
										},
									},
								};
								if (
									index === selections.length - 1 &&
									strList.length > selections.length
								) {
									decoration = {
										range: new vscode.Range(
											parameter.origCursorPos[
												index
											].anchor.line,
											parameter.origCursorPos[index]
												.anchor.character -
												parameter.origTextSel[index]
													.length,
											parameter.origCursorPos[
												index
											].active.line,
											parameter.origCursorPos[
												index
											].active.character,
										),
										renderOptions: {
											after: {
												contentText: strList
													.slice(index)
													.join(
														parameter.config
															.delimiter,
													)
													.replace(/\s/g, '\u00A0'),
											},
										},
									};
								}
								decorations.push(decoration);
							},
						);
				},
				{ undoStopBefore: false, undoStopAfter: false },
			);
			editor.setDecorations(previewDecorationType, decorations);
			break;
		case 'final':
			editor.setDecorations(previewDecorationType, []);
			try {
				previewDecorationType.dispose();
			} catch {}
			previewDecorationType = null;

			editor
				.edit(
					function (builder) {
						currentSelection &&
							currentSelection.forEach(
								function (selection, index, selections) {
									if (input != null) {
										// Nur wenn Eingabe nicht abgebrochen wurde
										if (index >= strList.length) return; // stop expression triggered

										const currSel = new vscode.Selection(
											parameter.origCursorPos[
												index
											].anchor.line,
											parameter.origCursorPos[
												index
											].anchor.character,
											parameter.origCursorPos[
												index
											].active.line,
											parameter.origCursorPos[
												index
											].active.character,
										);
										let currentString = strList[index];

										if (
											index === selections.length - 1 &&
											strList.length > selections.length
										) {
											builder.replace(
												currSel,
												strList
													.slice(index)
													.join(
														parameter.config
															.delimiter,
													)
													.replace(/\s/g, '\u00A0'),
											);
										} else {
											builder.replace(
												currSel,
												strList[index],
											);
										}
									} else {
										// bei Abbruch der Eingabe: ursprünglichen Text wiederherstellen
										const currSel = new vscode.Selection(
											parameter.origCursorPos[
												index
											].anchor.line,
											parameter.origCursorPos[
												index
											].anchor.character,
											parameter.origCursorPos[
												index
											].anchor.line,
											parameter.origCursorPos[
												index
											].anchor.character,
										);
										builder.replace(
											currSel,
											parameter.origTextSel[index],
										);
									}
									// // Multi selection / multiple cursors
									// selections.push(
									// 	new vscode.Selection(
									// 		new vscode.Position(
									// 			parameter.origCursorPos[
									// 				index
									// 			].anchor.line,
									// 			parameter.origCursorPos[
									// 				index
									// 			].anchor.character,
									// 		),
									// 		new vscode.Position(
									// 			parameter.origCursorPos[
									// 				index
									// 			].anchor.line,
									// 			parameter.origCursorPos[
									// 				index
									// 			].anchor.character,
									// 		),
									// 	),
									// );
								},
							);
						// optional: sichtbaren Bereich an erste Auswahl anpassen
						// editor.selections = selections;

						// editor.revealRange(
						// 	editor.selections[0],
						// 	vscode.TextEditorRevealType.InCenterIfOutsideViewport,
						// );
					},
					{ undoStopBefore: false, undoStopAfter: false },
				)
				.then(
					() => {
						// defensive cleanup wenn edit erfolgreich war
						try {
							if (previewDecorationType) {
								editor.setDecorations(
									previewDecorationType,
									[],
								);
								previewDecorationType.dispose();
								previewDecorationType = null;
							}
						} catch {}
					},
					() => {
						// in case of error also dispose to avoid leaking decoration types
						try {
							if (previewDecorationType) {
								editor.setDecorations(
									previewDecorationType,
									[],
								);
								previewDecorationType.dispose();
								previewDecorationType = null;
							}
						} catch {}
					},
				);
			break;
	}

	return strList;
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
		default:
			const retStr = { stringFunction: '', stopFunction: true };
			return (i) => retStr;
	}
}

function getInputType(input: string, p: TParameter): TInputType | null {
	let type: TInputType = null;

	const alphabet: string = p.config.get('start') || '';

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
		case /^$/i.test(input):
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
		case /^&/i.test(input):
			type = 'own';
			break;
		// kein Typ erkennbar
		default:
			type = null;
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
		origTextStr: '',
		currentValueStr: '',
		previousValueStr: '',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
		currentIndexStr: '',
	};

	return (i) => {
		let stopExpressionTriggered = false;

		let value =
			start +
			steps * Math.trunc(((i % startover) % (freq * repe)) / freq);

		replacableValues.origTextStr = parameter.origTextSel[i];
		replacableValues.currentIndexStr = i.toString();
		replacableValues.currentValueStr = value.toString(base);
		replacableValues.previousValueStr =
			i > 0
				? (
						start +
						steps *
							Math.trunc(
								(((i - 1) % startover) % (freq * repe)) / freq,
							)
					).toString()
				: '0';

		// if expression exists, evaluate expression with current Value and replace newValue with result of expression.
		// if expression does not lead to a number, the current / new value will not be changed
		try {
			value =
				Number(
					runExpression(replaceSpecialChars(expr, replacableValues)),
				) || value;
		} catch {}

		if (stopexpr.length > 0) {
			// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
			try {
				stopExpressionTriggered = Boolean(
					runExpression(
						replaceSpecialChars(stopexpr, replacableValues),
					),
				);
			} catch {
				stopExpressionTriggered = i >= parameter.origCursorPos.length;
			}
		} else {
			stopExpressionTriggered = i >= parameter.origCursorPos.length;
		}

		// apply formatting if format string is given and return formatted value
		if (format !== '') {
			return {
				stringFunction: formatting.formatNumber(value, format),
				stopFunction: stopExpressionTriggered,
			};
		} else {
			return {
				stringFunction: value.toString(base),
				stopFunction: stopExpressionTriggered,
			};
		}
	};
}

function createStringSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	const start =
		input.match(parameter.segments['start_alpha'])?.groups?.start || '';
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

	// erkennen ob der eingegebene Start komplett GROSS geschrieben ist
	const startIsAllUpper =
		start !== '' &&
		start === start.toUpperCase() &&
		start !== start.toLowerCase();

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
		origTextStr: '',
		currentValueStr: '',
		previousValueStr: '',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
		currentIndexStr: '',
	};

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

	const currentIndex = stringToIndex(start);

	return (i) => {
		replacableValues.origTextStr = parameter.origTextSel[i];
		replacableValues.currentIndexStr = i.toString();
		replacableValues.currentValueStr = indexToString(
			currentIndex +
				steps * Math.trunc(((i % startover) % (freq * repe)) / freq),
		);
		replacableValues.previousValueStr =
			i > 0
				? indexToString(
						currentIndex +
							steps *
								Math.trunc(
									(((i - 1) % startover) % (freq * repe)) /
										freq,
								),
					)
				: '';

		let value = indexToString(
			currentIndex +
				steps * Math.trunc(((i % startover) % (freq * repe)) / freq),
		);
		let stopExpr = false;

		// if expression does not lead to a string, the current / new value will not be changed
		try {
			value = String(
				runExpression(replaceSpecialChars(expr, replacableValues)),
			);
		} catch {}

		// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
		if (stopexpr.length > 0) {
			try {
				stopExpr = Boolean(
					runExpression(
						replaceSpecialChars(stopexpr, replacableValues),
					),
				);
			} catch {
				stopExpr = i >= parameter.origCursorPos.length;
			}
		} else {
			stopExpr = i >= parameter.origCursorPos.length;
		}

		// Wenn der Start komplett groß war -> Ausgabe in GROSS
		if (startIsAllUpper && value !== '') {
			value = value.toUpperCase();
		}

		return {
			stringFunction: formatting.formatString(value, format),
			stopFunction: stopExpr,
		};
	};
}

function createDateSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	const start = input.match(parameter.segments['start_date'])?.groups?.start;
	const defaultReturn = { stringFunction: '', stopFunction: true };
	if (!start) return (i) => defaultReturn;

	let yearStr =
		input.match(parameter.segments['start_date'])?.groups?.year ||
		Temporal.Now.plainDateISO().year.toString();
	if (yearStr.length === 2)
		yearStr = parameter.config.get('century') + yearStr;
	const year = Number(yearStr) || Temporal.Now.plainDateISO().year;
	const month =
		Number(input.match(parameter.segments['start_date'])?.groups?.month) ||
		Temporal.Now.plainDateISO().month;
	const day =
		Number(input.match(parameter.segments['start_date'])?.groups?.day) ||
		Temporal.Now.plainDateISO().day;

	const language =
		input.match(parameter.segments['start_date'])?.groups?.language ||
		parameter.config.get('language') ||
		'de';

	const steps =
		Number(input.match(parameter.segments['steps_other'])?.groups?.steps) ||
		Number(parameter.config.get('step')) ||
		1;
	const unit =
		input.match(parameter.segments['start_date'])?.groups?.date_unit ||
		parameter.config.get('dateStepUnit') ||
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
		input.match(parameter.segments['format_date'])?.groups?.format_date ||
		parameter.config.get('format') ||
		'dd.MM.yyyy';

	const instant = Temporal.PlainDateTime.from({
		year: year,
		month: month,
		day: day,
		hour: 0,
		minute: 0,
		second: 0,
		millisecond: 0,
		microsecond: 0,
		nanosecond: 0,
	});

	const replacableValues: TSpecialReplacementValues = {
		origTextStr: '',
		currentValueStr: '',
		previousValueStr: '',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
		currentIndexStr: '',
	};

	return (i) => {
		replacableValues.origTextStr = parameter.origTextSel[i];
		replacableValues.currentIndexStr = i.toString();
		replacableValues.currentValueStr = '1';
		replacableValues.previousValueStr = '1';

		let idx = steps * Math.trunc(((i % startover) % (freq * repe)) / freq);

		if (idx >= 0) {
			switch (unit) {
				case 'w':
					return {
						stringFunction: formatting.formatTemporalDateTime(
							instant.add({ weeks: idx }),
							format,
							language,
						),
						stopFunction: i >= parameter.origCursorPos.length,
					};
				case 'm':
					return {
						stringFunction: formatting.formatTemporalDateTime(
							instant.add({ months: idx }),
							format,
							language,
						),
						stopFunction: i >= parameter.origCursorPos.length,
					};
				case 'y':
					return {
						stringFunction: formatting.formatTemporalDateTime(
							instant.add({ years: idx }),
							format,
							language,
						),
						stopFunction: i >= parameter.origCursorPos.length,
					};
				default:
					return {
						stringFunction: formatting.formatTemporalDateTime(
							instant.add({ days: idx }),
							format,
							language,
						),
						stopFunction: i >= parameter.origCursorPos.length,
					};
			}
		} else {
			switch (unit) {
				case 'w':
					return {
						stringFunction: formatting.formatTemporalDateTime(
							instant.subtract({ weeks: Math.abs(idx) }),
							format,
							language,
						),
						stopFunction: i >= parameter.origCursorPos.length,
					};
				case 'm':
					return {
						stringFunction: formatting.formatTemporalDateTime(
							instant.subtract({ months: Math.abs(idx) }),
							format,
							language,
						),
						stopFunction: i >= parameter.origCursorPos.length,
					};
				case 'y':
					return {
						stringFunction: formatting.formatTemporalDateTime(
							instant.subtract({ years: Math.abs(idx) }),
							format,
							language,
						),
						stopFunction: i >= parameter.origCursorPos.length,
					};
				default:
					return {
						stringFunction: formatting.formatTemporalDateTime(
							instant.subtract({ days: Math.abs(idx) }),
							format,
							language,
						),
						stopFunction: i >= parameter.origCursorPos.length,
					};
			}
		}
	};
}

function createExpressionSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// const retFunction = { stringFunction: '', stopFunction: true };
	// return (i) => retFunction;

	const expr =
		input.match(parameter.segments['expression'])?.groups?.expr || '';
	const stopexpr =
		input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ||
		'';

	const replacableValues: TSpecialReplacementValues = {
		origTextStr: '',
		currentValueStr: '',
		previousValueStr: '',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
		currentIndexStr: '',
	};

	return (i) => {
		replacableValues.origTextStr = parameter.origTextSel[i];
		replacableValues.previousValueStr = '';

		if (i > 0) {
			try {
				replacableValues.currentIndexStr = (i - 1).toString();
				replacableValues.previousValueStr = String(
					runExpression(replaceSpecialChars(expr, replacableValues)),
				);
			} catch {
				replacableValues.previousValueStr = '';
			}
		}

		try {
			replacableValues.currentIndexStr = i.toString();
			replacableValues.currentValueStr = String(
				runExpression(replaceSpecialChars(expr, replacableValues)),
			);
		} catch {
			replacableValues.currentValueStr = '';
		}

		let stopExpr = false;

		// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
		if (stopexpr.length > 0) {
			try {
				stopExpr = Boolean(
					runExpression(
						replaceSpecialChars(stopexpr, replacableValues),
					),
				);
			} catch {
				stopExpr = i >= parameter.origCursorPos.length;
			}
		} else {
			stopExpr = i >= parameter.origCursorPos.length;
		}

		return {
			stringFunction: replacableValues.currentValueStr,
			stopFunction: stopExpr,
		};
	};
}

function createOwnSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	type StartsOptions = {
		/** Case-insensitive comparison (default: false) */
		ignoreCase?: boolean;
		/** Wenn true, gilt '' (leerer x) als Match für den ersten Eintrag; default: false ('' -> kein Match) */
		emptyMatchesAll?: boolean;
	};

	function arrayStartsWithString(
		x: string,
		a: string[],
		options?: StartsOptions,
	): number {
		const { ignoreCase = false, emptyMatchesAll = false } = options || {};

		if (x == null) return -1;
		if (x.length === 0 && !emptyMatchesAll) return -1;

		if (ignoreCase) {
			const lx = x.toLocaleLowerCase();
			return a.findIndex((s) => s.toLocaleLowerCase().startsWith(lx));
		} else {
			return a.findIndex((s) => s.startsWith(x));
		}
	}

	const ownSequences: string[][] = parameter.config.get('ownSequences') || [
		[],
	];

	const sequenceInput =
		input.match(parameter.segments['ownsequence'])?.groups?.ownseq || '';

	let ownSeq: string[] = [];
	let start = 0;

	for (let i = 0; i < ownSequences.length; i++) {
		let l = arrayStartsWithString(sequenceInput, ownSequences[i]);
		if (l > -1) {
			ownSeq = ownSequences[i];
			start = l;
			break;
		}
	}

	return (i) => {
		if (ownSeq.length === 0) {
			return { stringFunction: '', stopFunction: true };
		} else {
			return {
				stringFunction:
					ownSeq[(start + i) % ownSeq.values.length] || '',
				stopFunction: i >= parameter.origCursorPos.length,
			};
		}
	};
}

function replaceSpecialChars(
	st: string,
	para: TSpecialReplacementValues,
): string {
	// _ ::= current value (before expression or value under current selection)
	// c ::= current value (only within expressions, includes value after expression)
	// p ::= previous value (last inserted)
	// a ::= value of <start>
	// s ::= value of <step>
	// n ::= number of selections
	// i ::= counter, starting with 0 and increasing with each insertion

	return st
		.replace(/\b_\b/gi, para.origTextStr)
		.replace(/\bc\b/gi, para.currentValueStr)
		.replace(/\bp\b/gi, para.previousValueStr)
		.replace(/\ba\b/gi, para.startStr)
		.replace(/\bs\b/gi, para.stepStr)
		.replace(/\bn\b/gi, para.numberOfSelectionsStr)
		.replace(/\bi\b/gi, para.currentIndexStr);
}

function runExpression(str: string): any {
	printToConsole('Running expression: ' + str);
	if (str[0] === '"' && str[str.length - 1] === '"') {
		str = str.slice(1, -1);
	}
	if (str[0] === "'" && str[str.length - 1] === "'") {
		str = str.slice(1, -1);
	}
	printToConsole('Stripped expression: ' + str);
	printToConsole(
		'Calculated expression: ' + new Function('return (' + str + ')')(),
	);
	return new Function('return (' + str + ')')();
}

// Get regular expressions for segmenting the input string
function getRegExpressions(): RuleTemplate {
	const matchRule: RuleTemplate = {
		start_decimal: '', // start Wert bei Zahlen
		start_alpha: '', // Start-Wert bei Buchstaben
		start_date: '', // Start-Wert bei Datumseingabe
		start_own: '', // Start-Wert bei eigenen Listen (string)
		steps_decimal: '', // Schritte bei Zahlen (auch mit Nachkommastellen möglich)
		steps_date: '', // Schritte bei einem Datum (es wird d, w, m oder y davor geschrieben, um zu sagen, welche Einheit die Steps sind)
		steps_other: '', // Schritte bei anderen Typen (nur Ganzzahl)
		format_decimal: '', // Formatierung der Zahlen
		format_alpha: '',
		format_date: '',
		language: '',
		repetition: '',
		frequency: '',
		startover: '', // startet von vorne, unabhängig von repetition und frequency
		random: '',
		ownsequence: '',
		expression: '',
		stopexpression: '',
		outputOrder: '',
		outputSort: '',
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
	ruleTemplate.charStartOwn = `;`;
	ruleTemplate.charStartExpr = `|`;
	ruleTemplate.charStartSteps = `:`;
	ruleTemplate.charStartFormat = `~`;
	ruleTemplate.charStartFrequency = `\\*`;
	ruleTemplate.charStartRepetition = `#`;
	ruleTemplate.charStartStartover = `##`;
	ruleTemplate.charStartOwnSequence = `\\[`;
	ruleTemplate.charStartExpression = `::`;
	ruleTemplate.charStartStopExpression = `@`;
	ruleTemplate.specialchars = `[_snpcai]`;
	ruleTemplate.integer = `(?:[1-9]\\d*|0)`;
	ruleTemplate.pointfloat = `(?: (?: [1-9]\\d*|0 )? \\. \\d+ )`;
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
	ruleTemplate.language = `(?: (?<language> \\w{2,3}(?:-?\\w{2,3})? )`;
	ruleTemplate.signedInt = `(?<int>[+-]? {{integer}})`;
	ruleTemplate.signedNum = `(?:[+-]? (?:{{numeric}} | {{hexNum}} | {{octNum}} | {{binNum}}))`;
	ruleTemplate.start_decimal = `^(?:(?<lead_string> (?<lead_char> {{leadchars}})\\k<lead_char>*)?(?<start>(?:{{signedNum}})) (?= {{delimiter}} ))`;
	ruleTemplate.start_alpha = `^(?:(?<start>[\\w]+) (?= {{delimiter}} ))`;
	ruleTemplate.start_date = `^(?:
									(?:{{charStartDate}})
									\\s*
									(?<start>
										(?<year>\\d{2}|\\d{4})
										(?:
											(?:-
												(?<month>0?[1-9]|10|11|12)
											)
											(?:-
												(?<day>0?[1-9]|[12][0-9]|30|31)
											)?
										)?
									)
									(?![\\d-])
									(?:{{language}})? )
									(?= {{delimiter}} )
								)`;
	ruleTemplate.start_expression = `^(?:(?:{{charStartExpr}}) \\s* (?= {{delimiter}} ))`;
	ruleTemplate.start_own = `^(?: ({{charStartOwn}})  \\s* (?<start> (?:(?:[\\d\\w]+(?:\\1[\\d\\w]+)*) | {{doublestring}} | {{singlestring}} )) (?= {{delimiter}} ))`;
	ruleTemplate.steps_decimal = `(?:(?<!{{charStartSteps}})(?:{{charStartSteps}}) \\s* (?<steps> {{signedNum}}) (?= {{delimiter}} ))`;
	ruleTemplate.steps_date = `(?:
									(?<!{{charStartSteps}})
									(?:{{charStartSteps}})
									\\s*
									(?<date_unit>[dwmy])?
									(?<steps> {{signedNum}})
									(?= {{delimiter}} )
								)`;
	ruleTemplate.steps_other = `(?:(?<!{{charStartSteps}})(?:{{charStartSteps}}) \\s* (?<steps> {{signedInt}}) (?= {{delimiter}} ))`;
	ruleTemplate.format_decimal = `(?: {{charStartFormat}} (?<format_decimal> (?<padding> {{leadchars}} )? (?<align> [<>^=] )? (?<sign> [ +-] )? (?<length> \\d+ ) (?<precision>\\.\\d+)? (?<type>[bcdeEfFgGnoxX%])? ) (?= {{delimiter}} ) )`;
	ruleTemplate.format_alpha = `(?: {{charStartFormat}} (?<padding> {{leadchars}} )? (?<align> [<>^=] )? (?<length> \\d+ ) (?= {{delimiter}} ) )`;
	ruleTemplate.format_date = `(?: {{charStartFormat}} (?<dateformat> .+) (?= {{delimiter}} ) )`;
	ruleTemplate.frequency = `(?:(?:{{charStartFrequency}}) \\s* (?<freq>\\d+) (?= {{delimiter}} ))`;
	ruleTemplate.repetition = `(?:(?<!{{charStartRepetition}})(?:{{charStartRepetition}}) \\s* (?<repeat>\\d+) (?= {{delimiter}} ))`;
	ruleTemplate.startover = `(?:(?:{{charStartStartover}}) \\s* (?<startover>\\d+) (?= {{delimiter}} ))`;
	ruleTemplate.random = `(?: (?: r \\s* (?<rndNumber> [+-]? \\d+)) (?= {{delimiter}}) )`;
	ruleTemplate.ownsequence = `(?:(?:{{charStartOwnSequence}}) \\s* (?<ownseq> (?:(?:(?<!\\\\)\\\\\\])|[^\\]])*)\\] (?= {{delimiter}} ))`;
	ruleTemplate.expression = `(?: {{charStartExpression}} \\s* 
								(?<expr>
									(.+)
									| ".+"
									| '.+'
									| .+
								)
								(?= {{delimiter}} )
							)`;
	ruleTemplate.stopexpression = `(?: {{charStartStopExpression}} \\s* 
									(?<stopexpr>
										(.+)
										| ".+"
										| '.+'
										| .+
									)
									(?= {{delimiter}} )
								)`;
	ruleTemplate.outputOrder = `\$!? $`;
	ruleTemplate.outputSort = `!\$? $`;

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

/*
		
		
		

		function hasKey(obj: RuleTemplate, key: string): boolean {
			return key in obj;
		}

		const ruleTemplate: RuleTemplate = {
			integer: '[1-9]\\d* | 0',
			hexdigits: '[1-9a-fA-F][0-9a-fA-F]*',
			signedint: '[+-]? {{integer}}',
			pointfloat: '({{integer}})? \\. \\d+ | {{integer}} \\.',
			exponentfloat: '(?:{{integer}} | {{pointfloat}}) [eE] [+-]? \\d+',
			float: '{{pointfloat}} | {{exponentfloat}}',
			hexNum: '0[xX]{{hexdigits}}',
			numeric: '{{integer}} | {{float}}',
			signedNum: '([+-]? {{numeric}})|{{hexNum}}',
			startNum:
				'([+-]? (?<lead_char1> 0+|\\s+|\\.+|_+)? {{numeric}})|((?<lead_char2> 0+|\\s+|\\.+|_+)? [+-]? {{numeric}})|{{hexNum}}',
			format:
				'((?<format_padding> [^}}])? (?<format_align> [<>^=]))? (?<format_sign> [-+ ])? #? (?<format_filled> 0)? (?<format_integer> {{integer}})? (\\.(?<format_precision> \\d+))? (?<format_type> [bcdeEfFgGnoxX%])?',
			alphastart: '[a-z]+ | [A-Z]+',
			alphaformat:
				'((?<alphaformat_padding>[^}}])? (?<alphaformat_align>[<>^])(?<alphaformat_correct> [lr])?)? ((?<alphaformat_integer>{{integer}}))?',
			dateformat:
				'(?:G{1,5}|y{1,5}|R{1,5}|u{1,5}|Q{1,5}|q{1,5}|M{1,5}|L{1,5}|w{1,2}|l{1,2}|d{1,2}|E{1,6}|i{1,5}|e{1,6}|c{1,6}|a{1,5}|b{1,5}|B{1,5}|h{1,2}|H{1,2}|k{1,2}|K{1,2}|m{1,2}|s{1,2}|S{1,4}|X{1,5}|x{1,5}|O{1,4}|z{1,4}|t{1,2}|T{1,2}|P{1,4}|p{1,4}|yo|qo|Qo|Mo|lo|Lo|wo|do|io|eo|co|ho|Ho|Ko|ko|mo|so|Pp|PPpp|PPPppp|PPPPpppp|.)*',
			monthtxt: '[\\p{L}\\p{M}]+|\\d{1,2}',
			monthformat: '(?:l(ong)?|s(hort)?)\\b',
			year: '(?:\\d{1,4})',
			month: '(?:12|11|10|0?[1-9])',
			day: '(?:3[012]|[12]\\d|0?[1-9])',
			date: '(?<date> (?<year> {{year}}?)(?:(?<datedelimiter>[-.])(?<month>{{month}})(?:\\k<datedelimiter>(?<day>{{day}}))?)?)?',
			datestep: '(?:(?<datestepunit>[dwmy])(?<datestepvalue>{{signedint}}))?',
			cast: '[ifsbm]',
			expr: '.+?',
			stopExpr: '.+?',
			exprMode:
				'^(?<cast> {{cast}})?\\|(~(?:(?<monthformat> {{monthformat}})|(?<format> {{format}}))::)? (?<expr> {{expr}}) (@(?<stopExpr> {{stopExpr}}))? (?<sort_selections> \\$)? (\\[(?<lang> [\\w-]+)\\])? (?<reverse> !)?$',
			insertNum:
				'^(?<start> {{startNum}})? (:(?<step> {{signedNum}}))? (r(?<random> \\+?[1-9]\\d*))? (\\*(?<frequency> {{integer}}))? (#(?<repeat> {{integer}}))? (~(?<format> {{format}}))? (::(?<expr> {{expr}}))? (@(?<stopExpr> {{stopExpr}}))? (?<sort_selections> \\$)? (?<reverse> !)?$',
			insertAlpha:
				'^(?<start> {{alphastart}}) (:(?<step> {{signedint}}))? (\\*(?<frequency> {{integer}}))? (#(?<repeat> {{integer}}))? (~(?<format> {{alphaformat}})(?<wrap> w)?)? (@(?<stopExpr> {{stopExpr}}))? (?<sort_selections> \\$)? (?<reverse> !)?$',
			insertMonth:
				'^(;(?<start> {{monthtxt}}))(:(?<step> {{signedint}}))? (\\*(?<frequency> {{integer}}))? (#(?<repeat> {{integer}}))? (~(?<monthformat> {{monthformat}}))? (@(?<stopExpr> {{stopExpr}}))? (\\[(?<lang> [\\w-]+)\\])? (?<sort_selections> \\$)? (?<reverse> !)?$',
			insertDate:
				'^(%(?<start> {{date}}|{{integer}})) (:(?<step> {{datestep}}))? (\\*(?<frequency> {{integer}}))? (#(?<repeat> {{integer}}))? (~(?<dateformat> {{dateformat}}))? (?<sort_selections> \\$)? (?<reverse> !)?$',
		};

		// TODO - linesplit einfügen (?:\\|(?<line_split>[^\\|]+)\\|)?
		const result: RuleTemplate = {
			exprMode: '',
			insertNum: '',
			insertAlpha: '',
			insertMonth: '',
			insertDate: '',
		};

		for (let [key, value] of Object.entries(ruleTemplate)) {
			while (value.indexOf('{{') > -1) {
				const start: number = value.indexOf('{{');
				const ende: number = value.indexOf('}}', start + 2) + 2;
				const replace: string = value.slice(start, ende);
				const rule: string = replace.slice(2, replace.length - 2);
				if (hasKey(ruleTemplate, rule)) {
					value = value.replace(replace, ruleTemplate[rule]); // works fine!
				}
			}
			if (hasKey(result, key)) {
				result[key] = value.replace(/\s/gi, '');
			}
		}

		return { result };
	
*/
