/*
The idea of the extension "InsertSeq" (previous InsertNums) based on the plugin insertnums 
for sublimecode from James Brooks
Original sublimecode extension: https://github.com/jbrooksuk/InsertNums

Version 1.0 is completely new written and additional features are added.

Volker Dobler
original from May 2020
rewritten August 2025
 */

const debug = false;

import * as vscode from 'vscode';
import * as assert from 'assert';

function printToConsole(str: string): void {
	if (debug) console.log('Debugging: ' + str);
}

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.commands.registerCommand('extension.insertseq', (value: string) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) { return; }

		InsertSeqCommand(context, value);
		printToConsole('Congratulations, extension "insertseq" is now active!');
	}));
}

export function deactivate() { }

const appName: string = 'insertseq';

interface RuleTemplate {
	[key: string]: string;
};

type TInputType = "decimal" | "hex" | "octal" | "binary" | "alpha" | "date" | "expression" | "own" | null;

// eingetippte Optionen (alles, was syntax erlaubt + zusätzlich der Type, der anhand des ersten Zeichens ermittelt wird)
interface IInput {
	type: TInputType,
	start: string,
	step: string,
	repetition: string,
	frequency: string,
	expr: string,
	stopexpr: string,
	ownsequence: string,
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



async function InsertSeqCommand(
	context: vscode.ExtensionContext,
	value: string
) {

// decimals: [<start>][:<step>][#<repeat>][*<frequency>][~<format>]r[+]<random>][::<expr>][@<stopexpr>][$][!]
// alpha: <start>[:<step>][#<repeat>][\*<frequency>][~<format>][w][@<stopexpr>][$][!]
// dates: %[<year>[-<month>[-<day>]]][:[dwmy]<step>][#<repeat>][*<frequency>][~<format>][$][!]
// expressions: [<cast>]|[~<format>::]<expr>[@<stopexpr>][$][!]
// own (war "months"): ;<start>[:<step>][#<repeat>][\*<frequency>][~<format>][@<stopexpr>][$][!]

	const editor = vscode.window.activeTextEditor;
	if (!editor) { return; }

	// read regular Expression for input string
	const inputSegments = getRegExpressions();

	// read config file - insertnums as of history reason (extension previously was named insertnums) and 'appName' as of current config file. 
	// config entries in appName overwrites same config entries in "insertnums"
	const config = Object.assign(vscode.workspace.getConfiguration('insertnums'), vscode.workspace.getConfiguration(appName));

	// get current selected Text
	const origTextSelections = editor.selections.map(selection => editor.document.getText(selection));
	// get current (multi-)cursor positions
	const origCursorPositions = editor.selections.map(selection => new vscode.Selection(selection.end, selection.end));

	// start with current selected Text which will be overwritten
	let currentSelection: string[] | null = origTextSelections;

	const inputOptions: vscode.InputBoxOptions = {
		placeHolder: "[<start>][:<step>][#<repetition>][*<frequency>][~<format>][[<ownselection>]][r[+]<random>][::<expr>][@<stopexpr>][$][!]",
		validateInput: function(input) {
			currentSelection = insertNewSequence(editor, currentSelection, input, origTextSelections, origCursorPositions, inputSegments);
			return "";
		}
	}

	vscode.window.showInputBox(inputOptions)
		.then(function(input:string | undefined) {
			currentSelection = insertNewSequence(editor, currentSelection, input, origTextSelections, origCursorPositions, inputSegments);
		})
}

function getRegExpressions(): RuleTemplate {

	const matchRule: RuleTemplate = {
		start_decimal: '',
		start_alpha: '',
		start_dates: '',
		start_own: '',
		steps_decimal: '',
		steps_other: '',
		repetition: '',
		frequency: '',
		ownsequence: '',
		stopexpression: '',
		expression: '',
		outputOrder: '',
		outputSort: ''
	};

// String-Eingabe: (?:"(?:(?:(?<!\\\\)\\\\")|[^"])+")
// String-Eingabe: (?:\'(?:(?:(?<!\\\\)\\\\\')|[^\'])+\')
// Klammer-Eingabe: (?:\\((?:(?:(?<!\\\\)\\\\\\))|[^)])+\\))

// Special Chars in Expressions:
// _ ::= current value (before expression or value under current selection)
// s ::= value of <step>
// n ::= number of selections
// p ::= previous value (last inserted)
// c ::= current value (only within expressions, includes value after expression)
// a ::= value of <start>
// i ::= counter, starting with 0 and increasing with each insertion
	const ruleTemplate: RuleTemplate = {
		delimiter: '(?:\\s*(?:[$:#\\*~@!\\[]|$))',
		specialchars: '[_snpcai]',
		integer: '(?:[1-9]\\d*|0)',
		pointfloat: '(?:(?:[1-9]\\d*|0)?\\.\\d+)',
		doublestring: '(?:"(?:(?:(?<!\\\\)\\\\")|[^"])+")',
		singlestring: '(?:\'(?:(?:(?<!\\\\)\\\\\')|[^\'])+\')',
		bracketedexpression: '(?:\\((?:(?:(?<!\\\\)\\\\\\))|[^)])+\\))',
		exponentfloat: '(?:(?:{{integer}} | {{pointfloat}}) [e] [+-]? \\d+)',
		float: '(?:{{pointfloat}} | {{exponentfloat}})',
		hexNum: '(?:0[x](?<hex>0|[1-9a-f][0-9a-f]*))',
		octNum: '(?:0[o](?<oct>0|[1-7][0-7]*))',
		binNum: '(?:0[b](?<bin>[01]+))',
		exproperator: '(?: \\s* (?:\\+|-|\\*|\\/|\\*\\*|mod|div) \\s* )',
		exprcompare: '(?:<=|<|>=|>|===|==)',
		numeric: '(?:(?<int>{{integer}}) | (?<float>{{float}}))',
		signedInt: '(?<int>[+-]? {{integer}})',
		signedNum: '(?:[+-]? (?:{{numeric}} | {{hexNum}} | {{octNum}} | {{binNum}}))',
		singexpr: '(?: \\s* (?: (?: [+-]? (?: {{integer}} | {{float}} ) ) | {{specialchars}} ) \\s* )',
		start_decimal: '^(?:(?<lead_string> (?<lead_char> [0\\s\\._])\\k<lead_char>*)?(?<start>(?:{{signedNum}})) (?= {{delimiter}} ))',
		start_alpha: '^(?:(?<start>[a-z]+) (?= {{delimiter}} ))',
		start_dates: '^(?:(?:%)(?<start>\\d{2}|\\d{4})(?:(?:-(?<month>0?[1-9]|10|11|12))(?:-(?<day>0?[1-9]|[12][0-9]|30|31))?)?(?![\\d-]) (?= {{delimiter}} ))',
		start_own: '^(?:(?<start> (;) (?:(?:[\\d\\w]+(?:\\2[\\d\\w]+)*) | {{doublestring}} | {{singlestring}} )) (?= {{delimiter}} ))',
		steps_decimal: '(?:(?<!:)(?::)(?<steps> {{signedNum}}) (?= {{delimiter}} ))',
		steps_other: '(?:(?<!:)(?::)(?<steps> {{signedInt}}) (?= {{delimiter}} ))',
		repetition: '(?:(?<=#)(?<repeat>\\d+) (?= {{delimiter}} ))',
		frequency: '(?:(?<=\\*)(?<freq>\\d+) (?= {{delimiter}} ))',
		ownsequence: '(?:(?<ownseq> \\[(?:(?:(?<!\\\\)\\\\\\])|[^\\]])*\\] (?= {{delimiter}} ))',
		expression: '(?: \\s* :: \\s* (?<expr> (?: {{singexpr}} (?: {{exproperator}} {{singexpr}} )* {{exprcompare}} {{singexpr}} (?: {{exproperator}} {{singexpr}} )* ) | {{bracketedexpression}} | {{doublestring}} | {{singlestring}}) (?= {{delimiter}} ))',
		stopexpression: '(?: \\s* @ \\s* (?<stopexpr> (?: {{singexpr}} (?: {{exproperator}} {{singexpr}} )* {{exprcompare}} {{singexpr}} (?: {{exproperator}} {{singexpr}} )* ) | {{bracketedexpression}} | {{doublestring}} | {{singlestring}}) (?= {{delimiter}} ))',
		outputOrder: '\$!? $',
		outputSort: '!\$? $',
	};

	for (let [key, value] of Object.entries(ruleTemplate)) {
		while (value.indexOf('{{') > -1) {
			const start: number = value.indexOf('{{');
			const ende: number = value.indexOf('}}', start + 2) + 2;
			const replace: string = value.slice(start, ende);
			const rule: string = replace.slice(2, replace.length - 2);
			if (rule in ruleTemplate) {
				value = value.replace(replace, ruleTemplate[rule]);
			}
		}
		if (key in matchRule) {
			matchRule[key] = value.replace(/\s/gi, '');
		}
	}

	return matchRule
}

// get Config-Information and return
function getConfig(crit: string, def : string = ''): string {
	return vscode.workspace.getConfiguration(appName).get(crit) ||
	vscode.workspace.getConfiguration('insertnums').get(crit) || def;
}

// Create new Sequence based on Input
function insertNewSequence(
	editor: vscode.TextEditor,
	currentSelection: string[] | null,
	input: string | undefined,
	textSelections: string[],
	cursorSelections: vscode.Selection[],
	matchRules: RuleTemplate,
): string[] | null {

	if (input == undefined) { return null; };

	const inputType: TInputType = getInputType(input);
	const currSequence = getCurrentSequence(inputtype);

	// const strList = selections.map((_, idx) => strGenerator(idx));
	// editor.edit(
	// 	function (builder) {
	// 		selections.forEach(function (selection, index) {
	// 			builder.replace(selection, strList[index]);
	// 		});
	// 	},
	// 	{ undoStopBefore: false, undoStopAfter: false }
	// );
	// return strList;

}

function getInputType(input: string): TInputType | null {

	let type: TInputType = null;

// What kind of input is it (check regex from begin)
	switch (true) {
		// nummerische Zahl
		case /^(?:([ _x0\.])\1*)?[+-]?\d/i.test(input):
			type = "decimal";
			break;
		// HEX Zahl
		case /^(?:([ _x0\.])\1*)?[+-]?0x[0-9a-f]+/i.test(input):
			type = "hex";
			break;
		// Oktal Zahl
		case /^(?:([ _x0\.])\1*)?[+-]?0o[0-7]+/i.test(input):
			type = "octal";
			break;
		// binäre Zahl
		case /^(?:([ _x0\.])\1*)?[+-]?0b[01]+/i.test(input):
			type = "binary";
			break;
		case /^\|/i.test(input):
			type = "expression";
			break;
		case /^[a-z]/ui.test(input):
			type = "alpha";
			break;
		case /^%/i.test(input):
			type = "date";
			break;
		case /^&/i.test(input):
			type = "own";
			break;
		default:
			type = null;
	};

	return type;
}

function getCurrentSequence(type: TInputType): string[] {

	switch (inputType) {
		case 'decimal':
			return createDecimalSeq(input, 10);
		case 'hex':
			return createDecimalSeq(input, 16);
		case 'octal':
			return createDecimalSeq(input, 8);
		case 'binary':
			return createDecimalSeq(input, 2);
		case 'alpha':
			return createStringSeq(input);
		case 'date':
			return createDateSeq(input);
		case 'expression':
			return createExpressionSeq(input);
		case 'own':
			return createOwnSeq(input);
		default:
			return [""]
	}
}

// Get Input-Options and return Object of TInput
function getInput(input: string): IInput | {} {

	let type: TInputType = null;
	let match = null;

	switch (true) {
		// nummerische Zahl
		case /^(?:([ _x0\.])\1*)?[+-]?\d/i.test(input):
			type = "decimal";
			// Optional ein Vorzeichen [ _x0.] (zur Formatierung der Zahl), einmal oder mehrmals, dann optional ein + oder - Zeichen und dann die Zahl, mit optional Nachkommastellen
			match = input.match(/^(?:(?<sub>([ _x0\.])\2*))?(?<start>[+-]?\d+(?:\.\d+)?)(?!\.)/ui);
			break;
		// HEX Zahl
		case /^(?:([ _x0\.])\1*)?[+-]?0x[0-9a-f]+/i.test(input):
			type = "hex";
			// Optional ein Vorzeichen [ _x0.] (zur Formatierung der Zahl), einmal oder mehrmals, dann optional ein + oder - Zeichen und dann die Zahl, mit optional Nachkommastellen
			match = input.match(/^(?:(?<sub>([ _x0\.])\2*))?0x(?<start>[0-9a-f]+)(?!\.)/ui);
			break;
		// Oktal Zahl
		case /^(?:([ _x0\.])\1*)?[+-]?0o[0-7]+/i.test(input):
			type = "octal";
			// Optional ein Vorzeichen [ _x0.] (zur Formatierung der Zahl), einmal oder mehrmals, dann optional ein + oder - Zeichen und dann die Zahl, mit optional Nachkommastellen
			match = input.match(/^(?:(?<sub>([ _x0\.])\2*))?0o(?<start>[0-7])(?!\.)/ui);
			break;
		// binäre Zahl
		case /^(?:([ _x0\.])\1*)?[+-]?0b[01]+/i.test(input):
			type = "binary";
			// Optional ein Vorzeichen [ _x0.] (zur Formatierung der Zahl), einmal oder mehrmals, dann optional ein + oder - Zeichen und dann die Zahl, mit optional Nachkommastellen
			match = input.match(/^(?:(?<sub>([ _x0\.])\2*))?0b(?<start>[01]+)(?!\.)/ui);
			break;
		case /^\|/i.test(input):
			type = "expression";
			match = input.match(/^\|(?:.+)/ui);
			break;
		case /^[a-z]/ui.test(input):
			type = "alpha";
			match = input.match(/^(?<start>[a-z]+)/ui);
			break;
		case /^%/i.test(input):
			type = "date";
			// Datum (YY[YY][-MM[-TT]])
			match = input.match(/^(?:%)(?<start>\d{2}|\d{4})(?:(?:-(?:0?[1-9]|10|11|12))(?:-(?:0?[1-9]|[12][0-9]|30|31))?)?(?![\d-])/ui);
			break;
		case /^&/i.test(input):
			type = "own";
			match = input.match(/^&(?<start>\p{L}+)/ui);
			break;
		default:
			type = null;
			match = ''
	};
// Step after : - could be hex, octal or decimal/number
	match = input.match(/(?<!:)(?::)0x(?<steps>[a-f0-9]+)/i);
	let temp = defaultValue.step || 1;
	if (match && match.groups?.steps) {
		temp = parseInt(match.groups.steps, 16);
	};
	match = input.match(/(?<!:)(?::)0o(?<steps>[0-7]+)/i);
	if (match && match.groups?.steps) {
		temp = parseInt(match.groups.steps, 8);
	};
	match = input.match(/(?<!:)(?::)0b(?<steps>[01]+)/i);
	if (match && match.groups?.steps) {
		temp = parseInt(match.groups.steps, 2);
	};
	match = input.match(/(?<!:)(?::)(?<steps>[+-]?\d+(\.\d+)?)/i);
	if (match && match.groups?.steps) {
		temp = parseFloat(match.groups.steps);
	};
	const steps = temp;

	// lösche die Angabe zu den "Steps" aus dem Input-String
	if (match && match.input) {
		input = match.input.replace(match[0],"");
	}

// Repeat after # - decimal/number only
	match = input.match(/(?<=#)(?<repeat>\d+)/i);
	const repeat = match && match.groups && match.groups.repeat ? match.groups.repeat : defaultValue.repeat || 0;

	// lösche die Angabe zu "repeats" aus dem Input-String
	if (match && match.input) {
		input = match.input.replace(match[0],"");
	}

// Frequences (starting with *) - decimal/number only
	match = input.match(/(?<=\*)(?<freq>\d+)/i);
	const frequency = match && match.groups && match.groups.freq ? match.groups.freq : defaultValue.frequency || 0;

	// lösche die Angabe zu "frequency" aus dem Input-String
	if (match && match.input) {
		input = match.input.replace(match[0],"");
	}

// Own sequences (inserted in [[ ... ]] and separated with , or ; or |)
	match = input.match(/(?<=\[\[)(?<own>[^\]]+)(?=\]\])/ui);
	if (match && match.groups && match.groups.own) {
		if (!defaultValue.ownsequences) {
			defaultValue.ownsequences = [];
		} else {
		defaultValue.ownsequences.push(Array.from(match.groups.own.split(/,|;|\|/)))
		}
	}
	const ownsequence = defaultValue.ownsequences || [];

	// lösche die Angabe zu "own sequences" aus dem Input-String
	if (match && match.input) {
		input = match.input.replace(match[0],"");
	}

// Formatting
	match = input.match(/(?<=~)(?<format>(?<padding>[ _0\.])?(?<align>[<>^=])?(?<sign>[-+ ])?(?<leading>[0])(?<length>\d+)(?:\.(?<precision>\d+)))/ui);
	const format = match && match.groups && match.groups.format ? match.groups.format : defaultValue.format || {format: "1", length: "1"};

	// lösche die Angabe zu "format" aus dem Input-String
	if (match && match.input) {
		input = match.input.replace(match[0],"");
	}

// Random Number (starts with r, followed by a number and a + optional)
	match = input.match(/(?<=r)(?<plus>+)(?<random>\d+)/i);
// HIER GEHTS WEITER




// Stopexpression (starting with @)
	match = input.match(/(?<=@)(?<stopexpr>[^])/i);

// Starts with a number of an alpha sequence
	const start = defaultValue.start || "1";

	return {
		type: type,
		start: start,
		steps: steps,
		repeat: repeat,
		frequency: frequency,
		ownsequence: ownsequence,
		format: format
	};


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
