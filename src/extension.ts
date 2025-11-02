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
import { formatNumber } from './formatting';

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

interface RuleTemplate {
	[key: string]: string;
}

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

type TParameter = {
	origCursorPos: vscode.Selection[];
	origTextSel: string[];
	segments: RuleTemplate;
	config: vscode.WorkspaceConfiguration;
	currentAlphabet: string;
};

type TSpecialChars = {
	origValue: string;
	newValue: string;
	previousValue: string;
	start: string;
	step: string;
	number: string;
	index: string;
};

// eingetippte Optionen (alles, was syntax erlaubt + zusätzlich der Type, der anhand des ersten Zeichens ermittelt wird)
interface IInput {
	type: TInputType;
	start: string;
	step: string;
	repetition: string;
	frequency: string;
	expr: string;
	stopexpr: string;
	ownsequence: string;
	format: string;
}

/*
// alle konfigurierbaren Kriterien
interface IConfig {
	start: string,
	step: string,
	frequency: string,
	repetition: string,
	numberFormat: string,
	stringFormat: string,
	dateFormat: string,
	insertOrder: string,
	language: string,
	century: string,
	centerString: string,
	dateStepUnit: string,
	delimiter: string,
	alphabet: string,
	ownsequences: (string[] | number[] | ((i:number) => string))[],
};
*/

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

	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}

	// read config file - insertnums as of history reason (extension previously was named insertnums) and 'appName' as of current config file.
	// config entries in appName overwrites same config entries in "insertnums"
	const config = Object.assign(
		{},
		vscode.workspace.getConfiguration('insertnums'),
		vscode.workspace.getConfiguration(appName),
	);

	// read regular Expression for input string
	const inputSegments = getRegExpressions();

	const currentAlphabet: string =
		config.get('alphabet') || 'abcdefghijklmnopqrstuvwxyz';

	// replace placeholder in regex with current alphabet
	inputSegments['start_alpha'] = inputSegments['start_alpha'].replace(
		'\\w',
		`${currentAlphabet}`,
	);

	// get current selected Text
	const origTextSelections = editor.selections.map((selection) =>
		editor.document.getText(selection),
	);

	editor.edit((builder) => {
		editor.selections.forEach((selection) => {
			builder.replace(selection, '');
		});
	});

	// get current (multi-)cursor positions
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
					segments: inputSegments,
					config: config,
					currentAlphabet: currentAlphabet,
				},
				false,
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
				segments: inputSegments,
				config: config,
				currentAlphabet: currentAlphabet,
			},
			true,
		);
	});
}

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
	ruleTemplate.singlestring = `(?:\'(?:(?:(?<!\\\\)\\\\\')|[^\'])+\')`;
	ruleTemplate.bracketedexpression = `(?:\\((?:(?:(?<!\\\\)\\\\\\))|[^)])+\\))`;
	ruleTemplate.leadchars = `[0x\\s\\._]`;
	ruleTemplate.delimiter = `(?:\\s*(?:[ {{charStartSteps}} {{charStartFormat}} {{charStartRepetition}} {{charStartFrequency}} {{charStartOwnSequence}} {{charStartStopExpression}} $ ! ] | $))`;
	ruleTemplate.exponentfloat = `(?:(?:{{integer}} | {{pointfloat}}) [e] [+-]? \\d+)`;
	ruleTemplate.float = `(?:{{pointfloat}} | {{exponentfloat}})`;
	ruleTemplate.hexNum = `(?:0[x](?<hex>0|[1-9a-f][0-9a-f]*))`;
	ruleTemplate.octNum = `(?:0[o](?<oct>0|[1-7][0-7]*))`;
	ruleTemplate.binNum = `(?:0[b](?<bin>[01]+))`;
	ruleTemplate.numeric = `(?:(?<int>{{integer}}) | (?<float>{{float}}))`;
	ruleTemplate.exprtoken = `(?: \\s* (?: (?: [+-]? (?: {{integer}} | {{float}} ) ) | {{specialchars}} ) \\s* )`;
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
	ruleTemplate.start_expression = `^(?:(?:{{charStartExpr}})  \\s* (?= {{delimiter}} ))`;
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
	ruleTemplate.random = `(: (:r \\s* (?<rndNumber> [+-]? \\d+)) (?= {{delimiter}}) )`;
	ruleTemplate.ownsequence = `(?:(?:{{charStartOwnSequence}}) \\s* (?<ownseq> (?:(?:(?<!\\\\)\\\\\\])|[^\\]])*)\\] (?= {{delimiter}} ))`;
	ruleTemplate.expression = `(?: {{charStartExpression}} \\s* (?<expr> (?: {{exprtoken}} (?: {{exproperator}} {{exprtoken}} )* {{exprcompare}} {{exprtoken}} (?: {{exproperator}} {{exprtoken}} )* ) | {{bracketedexpression}} | {{doublestring}} | {{singlestring}}) (?= {{delimiter}} ))`;
	ruleTemplate.stopexpression = `(?: {{charStartStopExpression}} \\s* (?<stopexpr> (?: {{exprtoken}} (?: {{exproperator}} {{exprtoken}} )* {{exprcompare}} {{exprtoken}} (?: {{exproperator}} {{exprtoken}} )* ) | {{bracketedexpression}} | {{doublestring}} | {{singlestring}}) (?= {{delimiter}} ))`;
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

// Create new Sequence based on Input
function insertNewSequence(
	editor: vscode.TextEditor,
	input: string | undefined, // der eingegebene Text
	currentSelection: string[] | null,
	parameter: TParameter,
	final: Boolean = true,
): string[] | null {
	const currSeqFunction = getSequenceFunction(input, parameter);

	const strList = currentSelection
		? currentSelection.map((_, idx) => currSeqFunction(idx))
		: [];

	// Verwende die gemeinsame previewDecorationType statt bei jeder Aufruf eine neue zu erstellen
	if (!previewDecorationType) {
		previewDecorationType = vscode.window.createTextEditorDecorationType({
			after: { color: '#888', margin: '0 0 0 0' },
		});
	}

	editor.setDecorations(previewDecorationType, []);

	if (final) {
		editor.setDecorations(previewDecorationType, []);
		try {
			previewDecorationType.dispose();
		} catch {}
		previewDecorationType = null;

		editor
			.edit(
				function (builder) {
					let selections: vscode.Selection[] = [];
					currentSelection &&
						currentSelection.forEach(function (selection, index) {
							// new Selection(anchorLine: number, anchorCharacter: number, activeLine: number, activeCharacter: number)
							let laenge = 0;
							if (input != null) {
								const currSel = new vscode.Selection(
									parameter.origCursorPos[index].anchor.line,
									parameter.origCursorPos[
										index
									].anchor.character,
									parameter.origCursorPos[index].active.line,
									parameter.origCursorPos[
										index
									].active.character,
								);
								builder.replace(currSel, strList[index]);
								laenge = strList[index].length;
							} else {
								const currSel = new vscode.Selection(
									parameter.origCursorPos[index].anchor.line,
									parameter.origCursorPos[
										index
									].anchor.character,
									parameter.origCursorPos[index].anchor.line,
									parameter.origCursorPos[
										index
									].anchor.character,
								);
								builder.replace(
									currSel,
									parameter.origTextSel[index],
								);
								laenge = parameter.origTextSel[index].length;
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
						});
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
							editor.setDecorations(previewDecorationType, []);
							previewDecorationType.dispose();
							previewDecorationType = null;
						}
					} catch {}
				},
				() => {
					// in case of error also dispose to avoid leaking decoration types
					try {
						if (previewDecorationType) {
							editor.setDecorations(previewDecorationType, []);
							previewDecorationType.dispose();
							previewDecorationType = null;
						}
					} catch {}
				},
			);
	} else {
		// Vorschau mit Decorations
		const decorations: vscode.DecorationOptions[] = [];
		editor.edit(
			function (builder) {
				currentSelection &&
					currentSelection.forEach(function (selection, index) {
						decorations.push({
							range: new vscode.Range(
								parameter.origCursorPos[index].anchor.line,
								parameter.origCursorPos[index].anchor
									.character -
									parameter.origTextSel[index].length,
								parameter.origCursorPos[index].active.line,
								parameter.origCursorPos[index].active.character,
							),
							renderOptions: {
								after: {
									contentText: strList[index].replace(
										/\s/g,
										'\u00A0',
									),
								},
							},
						});
					});
			},
			{ undoStopBefore: false, undoStopAfter: false },
		);
		editor.setDecorations(previewDecorationType, decorations);
	}
	return strList;
}

function getSequenceFunction(
	input: string | undefined,
	p: TParameter,
): (i: number) => string {
	// bei "undefined" wurde die Eingabe abgebrochen - überschreibe die bisherig (temporären) Eingaben
	if (input == null) return (i) => '';

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
			return (i) => '';
	}
}

function getInputType(input: string, p: TParameter): TInputType | null {
	let type: TInputType = null;

	const alphabet = p.currentAlphabet || '';

	// helper: regex-escape
	const escapeForRegex = (s: string) =>
		s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

	// Beispiel 1: alphabet als Prefix-String (matcht genau diese Buchstabenfolge)
	// const reAlphabet = new RegExp('^' + escapeForRegex(alphabet), 'iu');

	// Beispiel 2 (empfohlen wenn alphabet eine Menge von Ein-Zeichen-Einträgen ist):
	// matcht, wenn das Input mit einem der Zeichen aus `alphabet` beginnt
	const chars = Array.from(alphabet).map(escapeForRegex).join('');
	const reAlphabetCharClass = new RegExp('^[' + chars + ']', 'iu');

	// What kind of input is it (check regex from begin)
	switch (true) {
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
		// HEX Zahl
		case /^\|/i.test(input):
			type = 'expression';
			break;
		case reAlphabetCharClass.test(input):
			type = 'alpha';
			break;
		case /^%/i.test(input):
			type = 'date';
			break;
		case /^&/i.test(input):
			type = 'own';
			break;
		default:
			type = null;
	}

	return type;
}

function createDecimalSeq(
	input: string,
	parameter: TParameter,
	base: number,
): (i: number) => string {
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

	const specialValues: TSpecialChars = {
		origValue: '',
		newValue: '',
		previousValue: '',
		start: '1', // start.toString(),
		step: '1', // steps.toString(),
		number: parameter.origCursorPos.length.toString(),
		index: '',
	};

	return (i) => {
		specialValues.origValue = parameter.origTextSel[i];
		specialValues.index = i.toString();
		const value =
			start +
			steps * Math.trunc(((i % startover) % (freq * repe)) / freq);
		// apply formatting if format string is given
		if (format !== '') {
			specialValues.newValue = formatNumber(value, format);
		} else {
			specialValues.newValue = value.toString(base);
		}

		// specialValues.newValue = String(1 + (1 * parseInt(((( i % 1) % (0 * 0)) / 0).toString(), base)));

		// if expression exists, evaluate expression with current Value and replace newValue with result of expression.
		// if expression does not lead to a number, the current / new value will not be changed
		try {
			let value = runExpression(replaceSpecialChars(expr, specialValues));
			if (typeof value === 'number') {
				specialValues.newValue = value.toString();
			}
		} catch {}

		// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
		try {
			let value = runExpression(
				replaceSpecialChars(stopexpr, specialValues),
			);
			if (typeof value === 'boolean' && value === true) {
				specialValues.newValue = '\u{0}';
			}
		} catch {}

		// previous Value wird auf den aktuellen Wert gesetzt
		specialValues.previousValue = specialValues.newValue;

		return specialValues.newValue;
	};
}

function createStringSeq(
	input: string,
	parameter: TParameter,
): (i: number) => string {
	const start =
		input.match(parameter.segments['start_alpha'])?.groups?.start || '';
	if (start === '') return (i) => '\u{0}';

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

	const specialValues: TSpecialChars = {
		origValue: '',
		newValue: '',
		previousValue: '',
		start: start.toString(),
		step: steps.toString(),
		number: parameter.origCursorPos.length.toString(),
		index: '',
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
		specialValues.origValue = parameter.origTextSel[i];
		specialValues.index = i.toString();
		let out = indexToString(
			Math.trunc(
				currentIndex +
					steps * (((i % startover) % (freq * repe)) / freq),
			),
		);

		// if expression does not lead to a string, the current / new value will not be changed
		try {
			let value = runExpression(replaceSpecialChars(expr, specialValues));
			if (typeof value === 'string') {
				out = value;
			}
		} catch {}

		// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
		try {
			let value = runExpression(
				replaceSpecialChars(stopexpr, specialValues),
			);
			if (typeof value === 'boolean' && value === true) {
				out = '\u{0}';
			}
		} catch {}

		// Wenn der Start komplett groß war -> Ausgabe in GROSS
		if (startIsAllUpper && out !== '\u{0}') {
			out = out.toUpperCase();
		}

		specialValues.newValue = out;
		// previous Value wird auf den aktuellen Wert gesetzt
		specialValues.previousValue = specialValues.newValue;

		return specialValues.newValue;
	};
}

function createDateSeq(
	input: string,
	parameter: TParameter,
): (i: number) => string {
	const start = input.match(parameter.segments['start_date'])?.groups?.start;
	if (!start) return (i) => '\u{0}';

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

	const instant = Temporal.PlainDate.from({
		year: year,
		month: month,
		day: day,
	});

	const specialValues: TSpecialChars = {
		origValue: '',
		newValue: '',
		previousValue: '',
		start: start.toString(),
		step: steps.toString(),
		number: parameter.origCursorPos.length.toString(),
		index: '',
	};

	return (i) => {
		specialValues.origValue = parameter.origTextSel[i];
		specialValues.index = i.toString();

		// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
		try {
			let value = runExpression(
				replaceSpecialChars(stopexpr, specialValues),
			);
			if (typeof value === 'boolean' && value === true) {
				specialValues.newValue = '\u{0}';
			}
		} catch {}

		let idx = Math.trunc(
			steps * (((i % startover) % (freq * repe)) / freq),
		);

		if (idx >= 0) {
			switch (unit) {
				case 'w':
					return instant.add({ weeks: idx }).toLocaleString(language);
					break;
				case 'm':
					return instant
						.add({ months: idx })
						.toLocaleString(language);
					break;
				case 'y':
					return instant.add({ years: idx }).toLocaleString(language);
					break;
				default:
					return instant.add({ days: idx }).toLocaleString(language);
			}
		} else {
			switch (unit) {
				case 'w':
					return instant
						.subtract({ weeks: Math.abs(idx) })
						.toLocaleString(language);
					break;
				case 'm':
					return instant
						.subtract({ months: Math.abs(idx) })
						.toLocaleString(language);
					break;
				case 'y':
					return instant
						.subtract({ years: Math.abs(idx) })
						.toLocaleString(language);
					break;
				default:
					return instant
						.subtract({ days: Math.abs(idx) })
						.toLocaleString(language);
			}
		}

		return '\u{0}';
	};
}

function createExpressionSeq(
	input: string,
	parameter: TParameter,
): (i: number) => string {
	return (i) => '';
}

function createOwnSeq(
	input: string,
	parameter: TParameter,
): (i: number) => string {
	return (i) => '';
}

function replaceSpecialChars(st: string, para: TSpecialChars): string {
	// _ ::= current value (before expression or value under current selection)
	// c ::= current value (only within expressions, includes value after expression)
	// p ::= previous value (last inserted)
	// a ::= value of <start>
	// s ::= value of <step>
	// n ::= number of selections
	// i ::= counter, starting with 0 and increasing with each insertion

	return st
		.replace(/\b_\b/gi, para.origValue)
		.replace(/\bc\b/gi, para.newValue)
		.replace(/\bp\b/gi, para.previousValue)
		.replace(/\ba\b/gi, para.start)
		.replace(/\bs\b/gi, para.step)
		.replace(/\bn\b/gi, para.number)
		.replace(/\bi\b/gi, para.index);
}

function runExpression(str: string): any {
	return new Function('return ' + str)();
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
