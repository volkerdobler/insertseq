/*
The extension "InsertSequences" (previous InsertNums) based on a plugin for sublimecode from James Brooks but is written completely new for VSCode
Original sublimecode extension: https://github.com/jbrooksuk/InsertNums

All errors are in my own responsibility and are solely done by
myself.

If you want to contact me, send an E-Mail to
insertsequences.extension@dobler-online.com

Volker Dobler
original from May 2020
rewritten July 2025
 */

const debug = false;

import * as vscode from 'vscode';
import assert = require('assert');
import { Interface } from 'readline';

function printToConsole(str: string): void {
	if (debug) console.log('Debugging: ' + str);
}

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.commands.registerCommand('extension.insertsequences', (value: string) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) { return; }

		InsertSequencesCommand(context, value);
		printToConsole('Congratulations, extension "insertseq" is now active!');
	}));
}

export function deactivate() { }

const appName: string = 'insertsequences';

async function InsertSequencesCommand(
	context: vscode.ExtensionContext,
	value: string
) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) { return; }

	const orgTextSelections = editor.selections.map(selection => editor.document.getText(selection));
	const orgMultiCursorEnds = editor.selections.map(selection => new vscode.Selection(selection.end, selection.end));

	let currentSelection: string[] | null = orgTextSelections;

	const defaultValues = getConfig();

	const inputOptions: vscode.InputBoxOptions = {
		placeHolder: "",
		validateInput: function(input) {
			currentSelection = createNewSequence(editor, currentSelection, input, orgTextSelections, orgMultiCursorEnds, defaultValues);
			return "";
		}
	}

	vscode.window.showInputBox(inputOptions)
		.then(function(input) {
			currentSelection = createNewSequence(editor, currentSelection, input, orgTextSelections, orgMultiCursorEnds, defaultValues);
		})
}

type TConfig = {
	start: string,
	step: number,
	repeat: number,
	frequency: number,
	format: string,
	random: number,
	expr: string,
	stopexpr: string,
	withSort: boolean,
	withRevert: boolean,
	ownsequences: string[][]
};

type TInputType = "decimal" | "hex" | "octal" | "binary" | "alpha" | "date" | "expression" | "own" | null;

type TInput = {
	type: TInputType,
	start: string,
	step: number,
	repeat: number,
	frequency: number,
	expr: string,
	stopexpr: string,
	ownsequence: string[],
	format: {
		format: string,
		padding: string | undefined,
		align: string | undefined,
		sign: string | undefined,
		leading: string | undefined,
		length: string,
		precision: string | undefined
	}
}

// get Config-Information and return TConfig Type
function getConfig(): TConfig {
	return { start: "1", step: 1, repeat: 1, frequency: 1, format: "", random: 0, expr: "", stopexpr: "", withSort: false, withRevert: false, ownsequences: [["foo", "bar", "bez"], ["alpha", "beta", "gamma", "delta"]]};
}

// Create new Sequence based on Input
function createNewSequence(
	editor: vscode.TextEditor,
	currentSelection: string[] | null,
	input: string | undefined,
	textSelections: string[],
	cursorSelections: vscode.Selection[],
	defaultValues: TConfig,
): string[] | null {

	if (input == undefined) { return null; };

	const options = getOptions(input, defaultValues);

	return [""]
}

// Get Input-Options and return Object of TInput
function getOptions(input: string, defaultValue: TConfig): TInput | {} {

	let type: TInputType = null;
	let match = null;

// What kind of input is it (check regex from begin)
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
		case /^[isfb]?|/i.test(input):
			type = "expression";
			match = input.match(/^(?:[isfb])|(?:.+)/ui);
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