import * as vscode from 'vscode';

// Template for the different segments of the regex input string
export interface RuleTemplate {
	[key: string]: string;
}

// Defines different input types (based on the beginning of the input string)
export type TInput =
	| 'decimal' // (normal) numbers (integer or float)
	| 'hex' // hexadecimal numbers
	| 'octal' // octal numbers
	| 'binary' // binary numbers
	| 'alpha' // strings (alphabetic) based on configured "alphabet"
	| 'date' // date values (e.g. 2023-11-05) (future: also time?)
	| 'expression' // expressions (JavaScript)
	| 'own' // own (war "months") - custom alphabetic sequences (inserted as [...] array)
	| 'predefined' // predefined text sequences (based on predefined lists in configuration)
	| 'function' // predefined functions (based on predefined functions in configuration)
	| 'textSelected' // no input - just use the originally selected text
	| null; // no valid input type detected

export type TStatus = 'preview' | 'final'; // status of the insertion (preview with decorations or final insertion)

// parameters passed to insertNewSequence() and subfunctions
export type TParameter = {
	editor: vscode.TextEditor;
	origCursorPos: vscode.Selection[];
	origTextSel: string[];
	segments: RuleTemplate;
	config: vscode.WorkspaceConfiguration;
	myDelimiter: string | null;
};

// Special chars replacements within expressions or stop expressions
export type TSpecialReplacementValues = {
	currentValueStr: string;
	valueAfterExpressionStr: string;
	previousValueStr: string;
	origTextStr: string;
	startStr: string;
	stepStr: string;
	numberOfSelectionsStr: string;
	currentIndexStr: string;
};

export type TOwnFunction = (
	i: number,
	start?: number,
	step?: number,
	freq?: number,
	repeat?: number,
	startOver?: number,
) => string;
