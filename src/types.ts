import * as vscode from 'vscode';

/** Dictionary of named regex-segment strings used to parse the user input. */
export interface RuleTemplate {
	[key: string]: string;
}

/**
 * Discriminated union of all recognised sequence input types.
 * The active type is determined by the leading characters of the input string.
 */
export type TInput =
	| 'decimal' // (normal) numbers (integer or float)
	| 'hex' // hexadecimal numbers
	| 'octal' // octal numbers
	| 'binary' // binary numbers
	| 'alpha' // strings (alphabetic) based on the configured alphabet
	| 'date' // date values (e.g. 2023-11-05)
	| 'expression' // JavaScript expressions
	| 'own' // custom item sequences defined as [...] arrays
	| 'predefined' // sequences from the mysequences configuration list
	| 'function' // user-defined functions from the myfunctions configuration list
	| 'textSelected' // no sequence — re-insert originally selected text
	| 'template' // quoted template string with {} placeholder replaced by the sequence value
	| 'backtick' // backtick template: `prefix text {sequence-def} suffix text`
	| null; // unrecognised input

/** Whether the current operation produces a live decoration preview or commits text to the document. */
export type TStatus = 'preview' | 'final';

/**
 * Shared context object passed from the command handler into every
 * sequence-creation function.
 */
export type TParameter = {
	/** The active text editor at the time the command was invoked. */
	editor: vscode.TextEditor;
	/** Cursor positions (zero-width selections) after the original selection text was deleted. */
	origCursorPos: vscode.Selection[];
	/** The text that was selected at each cursor before it was deleted. */
	origTextSel: string[];
	/** Compiled regex-segment strings produced by {@link getRegExpressions}. */
	segments: RuleTemplate;
	/** Workspace-configuration snapshot for the `insertseq` namespace. */
	config: vscode.WorkspaceConfiguration;
	/** Per-invocation delimiter override extracted from the start segment, or `null`. */
	myDelimiter: string | null;
};

/**
 * Named values substituted for the single-letter tokens inside expression and
 * stop-expression strings before evaluation.
 *
 * Token mapping:
 * - `_` → {@link currentValueStr}
 * - `c` → {@link valueAfterExpressionStr}
 * - `p` → {@link previousValueStr}
 * - `o` → {@link origTextStr}
 * - `a` → {@link startStr}
 * - `s` → {@link stepStr}
 * - `n` → {@link numberOfSelectionsStr}
 * - `i` → {@link currentIndexStr}
 */
export type TSpecialReplacementValues = {
	/** `_` — current sequence value before the expression is applied. */
	currentValueStr: string;
	/** `c` — current sequence value after the expression is applied. */
	valueAfterExpressionStr: string;
	/** `p` — value produced in the previous iteration. */
	previousValueStr: string;
	/** `o` — original text that was selected at the current cursor position. */
	origTextStr: string;
	/** `a` — the configured or parsed start value. */
	startStr: string;
	/** `s` — the configured or parsed step value. */
	stepStr: string;
	/** `n` — total number of active cursor positions. */
	numberOfSelectionsStr: string;
	/** `i` — zero-based insertion index. */
	currentIndexStr: string;
};

/**
 * Signature for user-defined sequence functions stored in the `myfunctions`
 * configuration list.
 *
 * @param i - Zero-based insertion index.
 * @param start - Start value (users should provide a default in their function definition).
 * @param step - Step value.
 * @param freq - How many times each value is repeated before advancing.
 * @param repeat - Number of emitted values before the sequence restarts.
 * @param startOver - Unconditional restart interval in emitted values.
 * @returns The string to insert at position `i`.
 */
export type TOwnFunction = (
	i: number,
	start?: number,
	step?: number,
	freq?: number,
	repeat?: number,
	startOver?: number,
) => string;
