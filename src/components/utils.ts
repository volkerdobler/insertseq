import * as vscode from 'vscode';
import { TParameter, TSpecialReplacementValues } from '../types';
import { safeEvaluate } from './safeEval';

// global debug flag
let debugInsertseq = false;

// output channel for debug messages
let outputChannel: vscode.OutputChannel | null = null;

/**
 * Create (or recreate) the named output channel used for debug messages.
 *
 * @param name - Display name shown in the VS Code Output panel.
 */
export function setOutputChannel(name: string): void {
	outputChannel = vscode.window.createOutputChannel(name);
}

/**
 * Dispose the output channel and release its resources.
 * Called from the extension's `deactivate` hook.
 */
export function removeOutputChannel(): void {
	if (outputChannel) {
		outputChannel.dispose();
		outputChannel = null;
	}
}

/**
 * Enable or disable debug logging for the current session.
 *
 * @param enabled - Pass `true` to activate debug output.
 */
export function setDebugMode(enabled: boolean): void {
	debugInsertseq = enabled;
}

/**
 * Write a debug message to the output channel (or `console.log` as fallback).
 * Does nothing when debug mode is off.
 *
 * @param str - Message to log.
 */
export function printToConsole(str: string): void {
	if (!debugInsertseq) {
		return;
	}
	if (outputChannel) {
		outputChannel.appendLine('Debugging insertseq: ' + str);
	} else {
		console.log('Debugging insertseq: ' + str);
	}
}

/**
 * Extract the step value from the input string, falling back to the
 * workspace configuration and finally to `1`.
 *
 * @param input - Raw user input string.
 * @param parameter - Shared command context.
 * @param which - Which step regex segment to use (`"steps_decimal"` by default).
 * @returns Parsed step as a number (never `NaN` — defaults to `1`).
 */
export function getStepValue(
	input: string,
	parameter: TParameter,
	which: string = 'steps_decimal',
): number {
	const stripInput = clearInput(input);

	return (
		Number(
			stripInput.match(parameter.segments[which])?.groups?.steps ??
				parameter.config.get('step'),
		) || 1
	);
}

/**
 * Extract the frequency value from the input string, falling back to the
 * workspace configuration and finally to `1`.
 *
 * @param input - Raw user input string.
 * @param parameter - Shared command context.
 * @returns Parsed frequency as a number (minimum 1).
 */
export function getFrequencyValue(
	input: string,
	parameter: TParameter,
): number {
	const stripInput = clearInput(input);

	return (
		Number(
			stripInput.match(parameter.segments['frequency'])?.groups?.freq ??
				parameter.config.get('frequency'),
		) || 1
	);
}

/**
 * Extract the repetition value from the input string, falling back to the
 * workspace configuration and finally to `Number.MAX_SAFE_INTEGER` (= no
 * repetition limit).
 *
 * @param input - Raw user input string.
 * @param parameter - Shared command context.
 * @returns Parsed repetition count, or `Number.MAX_SAFE_INTEGER` when absent.
 */
export function getRepeatValue(input: string, parameter: TParameter): number {
	const stripInput = clearInput(input);

	return (
		Number(
			stripInput.match(parameter.segments['repetition'])?.groups
				?.repeat ?? parameter.config.get('repetition'),
		) || Number.MAX_SAFE_INTEGER
	);
}

/**
 * Extract the startover value from the input string, falling back to the
 * workspace configuration and finally to `Number.MAX_SAFE_INTEGER` (= never
 * restart unconditionally).
 *
 * @param input - Raw user input string.
 * @param parameter - Shared command context.
 * @returns Parsed startover interval, or `Number.MAX_SAFE_INTEGER` when absent.
 */
export function getStartOverValue(
	input: string,
	parameter: TParameter,
): number {
	const stripInput = clearInput(input);

	return (
		Number(
			stripInput.match(parameter.segments['startover'])?.groups
				?.startover ?? parameter.config.get('startover'),
		) || Number.MAX_SAFE_INTEGER
	);
}

/**
 * Return the suffix of `input` starting at the first position where `regExpr`
 * matches, after masking paired brackets and quoted strings so that delimiters
 * inside them are not accidentally treated as segment boundaries.
 *
 * @param input - Raw user input string.
 * @param regExpr - Regex that identifies the start of the desired segment.
 * @returns The tail of `input` from the match position onward, or `""` if not found.
 */
export function getInputPart(input: string, regExpr: RegExp): string {
	const maskedInput = maskPairedAndQuoted(input);
	const startIndex = maskedInput.search(regExpr);
	if (startIndex === -1) {
		return '';
	}
	return input.slice(startIndex);
}

/**
 * Extract the stop-expression string from the input, or return `""` when
 * none is present.
 *
 * Paired brackets and quoted strings are masked before searching so that an
 * `@` inside an expression body is not mistaken for the stop-expression
 * delimiter.
 *
 * @param input - Raw user input string.
 * @param parameter - Shared command context.
 * @returns The stop-expression source string (without surrounding delimiters/quotes).
 */
export function getStopExpression(
	input: string,
	parameter: TParameter,
): string {
	// mask paired and quoted segments to avoid misinterpreting @ inside them
	const maskedInput = maskPairedAndQuoted(input);
	// find stopexpression starting from first @
	const startIndex = maskedInput.search(
		new RegExp(parameter.segments['charStartStopExpression'], 'i'),
	);
	// if no stop expression is found, return empty string
	if (startIndex === -1) {
		return '';
	}
	// extract stopexpression from original input starting at found index
	const parameterStopexpr = input
		.slice(startIndex)
		.match(parameter.segments['stopexpression']);
	// return extracted stopexpression or empty string
	return parameterStopexpr?.groups?.stopexpr
		? parameterStopexpr.groups.indoublequotes ||
				parameterStopexpr.groups.insinglequotes ||
				parameterStopexpr.groups.inbrackets ||
				parameterStopexpr.groups.stopexpr ||
				''
		: '';
}

/**
 * Extract the inline expression (`::expr`) from the input string, or return
 * `""` when none is present.
 *
 * @param input - Raw user input string.
 * @param parameter - Shared command context.
 * @returns The expression source string (without surrounding delimiters/quotes).
 */
export function getExpression(input: string, parameter: TParameter): string {
	const maskedInput = maskPairedAndQuoted(input);
	const startIndex = maskedInput.search(
		new RegExp(parameter.segments['charStartExpression'], 'i'),
	);
	if (startIndex === -1) {
		return '';
	}

	// replace leading wrapped parentheses with quotes to simplify extraction (because regex can't handle nested parentheses)
	const regExpString = replaceLeadingWrappedParenthesesWithQuotes(
		input.slice(startIndex),
	);

	const parameterExpression = regExpString.match(
		parameter.segments['expression'],
	);
	return parameterExpression?.groups?.expr
		? parameterExpression.groups.indoublequotes ||
				parameterExpression.groups.insinglequotes ||
				parameterExpression.groups.inbrackets ||
				parameterExpression.groups.expr ||
				''
		: '';
}

/**
 * Evaluate the stop expression for insertion index `currentIndex` and return
 * whether the sequence should stop.
 *
 * Falls back to `currentIndex >= selections` when the expression is empty,
 * evaluates to `null`, or throws.
 *
 * @param currentIndex - Zero-based index of the current insertion.
 * @param stopexpr - Stop-expression source string (may be empty).
 * @param selections - Total number of cursor positions.
 * @param replacableValues - Token values substituted before evaluation.
 * @returns `true` when the sequence should stop, `false` to continue.
 */
export function checkStopExpression(
	currentIndex: number,
	stopexpr: string,
	selections: number,
	replacableValues: TSpecialReplacementValues,
): boolean {
	let stopExpressionTriggered = currentIndex >= selections;
	try {
		const exprResult = runExpression(
			replaceSpecialChars(stopexpr, replacableValues),
		);
		if (exprResult != null) {
			stopExpressionTriggered = Boolean(exprResult);
		} else {
			stopExpressionTriggered = currentIndex >= selections;
		}
	} catch {
		printToConsole(
			'Error evaluating stop expression - falling back to default stop condition.',
		);
		stopExpressionTriggered = currentIndex >= selections;
	}
	return stopExpressionTriggered;
}

/**
 * Substitute the single-letter expression tokens in `st` with their current
 * runtime values from `para`.
 *
 * Token mapping:
 * - `_` → current value before expression
 * - `o` → original selected text
 * - `c` → current value after expression
 * - `p` → previous value
 * - `a` → start value
 * - `s` → step value
 * - `n` → number of selections
 * - `i` → current zero-based index
 *
 * Numeric values are substituted bare; string values are wrapped in single
 * quotes so the resulting string is valid JavaScript.
 *
 * @param st - Expression or stop-expression string containing tokens.
 * @param para - Current token values.
 * @returns The string with all tokens replaced by their current values.
 */
export function replaceSpecialChars(
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
		.replace(/\b_\b/gi, `'${para.currentValueStr}'`)
		.replace(
			/\bo\b/gi,
			Number(para.origTextStr)
				? para.origTextStr
				: `'${para.origTextStr}'`,
		)
		.replace(
			/\bc\b/gi,
			Number(para.valueAfterExpressionStr)
				? para.valueAfterExpressionStr
				: `'${para.valueAfterExpressionStr}'`,
		)
		.replace(
			/\bp\b/gi,
			Number(para.previousValueStr)
				? para.previousValueStr
				: `'${para.previousValueStr}'`,
		)
		.replace(/\ba\b/gi, para.startStr)
		.replace(/\bs\b/gi, para.stepStr)
		.replace(/\bn\b/gi, para.numberOfSelectionsStr)
		.replace(/\bi\b/gi, para.currentIndexStr);
}

/**
 * Evaluate `str` as a JavaScript expression via {@link safeEvaluate} and
 * return its result, or `null` on error or empty input.
 *
 * Surrounding quote characters (`"..."` or `'...'`) are stripped before
 * evaluation so that quoted string literals from the regex parser are handled
 * transparently.
 *
 * @param str - Expression source string, optionally surrounded by quotes.
 * @returns The evaluated value, or `null` when evaluation fails or yields nothing.
 */
export function runExpression(str: string): any {
	// strip surrounding quotes
	if (!str || str.length === 0) return null;
	if (str[0] === '"' && str[str.length - 1] === '"') {
		str = str.slice(1, -1);
	}
	if (str[0] === "'" && str[str.length - 1] === "'") {
		str = str.slice(1, -1);
	}

	printToConsole('Evaluating expression: ' + str);
	let res: any;
	try {
		res = safeEvaluate ? safeEvaluate(str, 1000) : null;
		if (res && res.ok) {
			return res.value;
		}
		return null;
	} catch (e) {
		printToConsole(
			'Error evaluating expression: ' +
				str +
				' , res=' +
				(res && res.ok) +
				':' +
				(res && res.value) +
				' err=' +
				String(e),
		);
		res = null;
	}

	return null;
}

/**
 * Strip all paired-bracket and quoted segments from `input` so that
 * delimiter characters inside them cannot be misread as segment boundaries.
 *
 * @param input - Raw input string, or `undefined` / empty.
 * @returns The input with all bracket/quote content removed, or `""`.
 */
function clearInput(input: string | undefined): string {
	if (!input) {
		return '';
	}
	return removePairedAndQuoted(input);
}

function isEscaped(s: string, pos: number): boolean {
	let k = pos - 1;
	let count = 0;
	while (k >= 0 && s[k] === '\\') {
		count++;
		k--;
	}
	return count % 2 === 1;
}

/**
 * Remove all paired-bracket (`(…)`, `[…]`, `{…}`) and quoted (`"…"`, `'…'`)
 * segments from `input`, preserving every character that lies outside them.
 *
 * Escaped delimiters (`\"`, `\)`, etc.) inside segments are handled correctly.
 * An unmatched opening bracket or quote is kept as a literal character.
 *
 * @param input - The string to process.
 * @returns The input with all bracketed/quoted content removed.
 */
export function removePairedAndQuoted(input: string): string {
	const opens: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
	const openChars = new Set(Object.keys(opens));
	const closeChars = new Set(Object.values(opens));

	const isEscaped = (s: string, pos: number): boolean => {
		let k = pos - 1;
		let count = 0;
		while (k >= 0 && s[k] === '\\') {
			count++;
			k--;
		}
		return count % 2 === 1;
	};

	// Helper: find end of quote starting at `start` (handles escapes)
	const findQuoteEnd = (s: string, start: number): number => {
		const quote = s[start];
		let j = start + 1;
		while (j < s.length) {
			// if this quote char is not escaped, it's the end
			if (s[j] === quote && !isEscaped(s, j)) return j;
			// if an unescaped backslash, skip next char
			if (s[j] === '\\' && !isEscaped(s, j)) {
				j += 2;
				continue;
			}
			j++;
		}
		return -1;
	};

	// Find matching closing bracket for bracket at `start`.
	// Skips escaped characters and quoted subsections.
	const findMatchingBracket = (s: string, start: number): number => {
		const opening = s[start];
		const expectedStack: string[] = [opens[opening]];
		let j = start + 1;
		while (j < s.length) {
			const ch = s[j];

			// if this char is escaped (i.e. preceded by an odd number of backslashes), treat literal
			if (isEscaped(s, j)) {
				j++;
				continue;
			}

			// handle unescaped backslash: skip next char
			if (ch === '\\') {
				j += 2;
				continue;
			}

			// skip quoted sections inside brackets (only if quote is not escaped)
			if ((ch === '"' || ch === "'") && !isEscaped(s, j)) {
				const qend = findQuoteEnd(s, j);
				if (qend === -1) {
					j++;
				} else {
					j = qend + 1;
				}
				continue;
			}

			// opening bracket -> push its closer (only if not escaped)
			if (openChars.has(ch) && !isEscaped(s, j)) {
				expectedStack.push(opens[ch]);
				j++;
				continue;
			}

			// closing bracket -> check stack top (only if not escaped)
			if (closeChars.has(ch) && !isEscaped(s, j)) {
				if (
					expectedStack.length > 0 &&
					ch === expectedStack[expectedStack.length - 1]
				) {
					expectedStack.pop();
					if (expectedStack.length === 0) return j;
				}
			}

			j++;
		}
		return -1;
	};

	let i = 0;
	const out: string[] = [];
	while (i < input.length) {
		const ch = input[i];

		// If this char is escaped (i.e. preceded by backslash), copy literally and advance one
		// Note: here we check whether current char itself is escaped by previous backslashes.
		if (isEscaped(input, i)) {
			out.push(ch);
			i++;
			continue;
		}

		// If escape char, copy it and the next char (don't treat escaped quotes/brackets as delimiters)
		if (ch === '\\') {
			if (i + 1 < input.length) {
				out.push(ch, input[i + 1]);
				i += 2;
			} else {
				out.push(ch);
				i++;
			}
			continue;
		}

		// Quotes (start) -> skip quoted segment entirely (including delimiters)
		if ((ch === '"' || ch === "'") && !isEscaped(input, i)) {
			const qend = findQuoteEnd(input, i);
			if (qend === -1) {
				// unclosed quote -> keep the quote char
				out.push(ch);
				i++;
			} else {
				// skip whole quoted segment
				i = qend + 1;
			}
			continue;
		}

		// Opening brackets -> find matching closing (skipping nested and quoted content)
		if (openChars.has(ch) && !isEscaped(input, i)) {
			const bend = findMatchingBracket(input, i);
			if (bend === -1) {
				// no matching closing bracket -> keep char
				out.push(ch);
				i++;
			} else {
				// skip whole bracketed segment including delimiters
				i = bend + 1;
			}
			continue;
		}

		// normal character -> keep
		out.push(ch);
		i++;
	}
	return out.join('');
}

/**
 * Replace all paired-bracket and quoted segments in `input` with space
 * characters of the same length, preserving the overall string length.
 *
 * This lets downstream code use positional `search()` / `slice()` on the
 * masked string to locate delimiters while still being able to extract the
 * original content from the unmasked string at the same indices.
 *
 * @param input - The string to process.
 * @returns A same-length string where bracketed/quoted content is replaced by spaces.
 */
export function maskPairedAndQuoted(input: string): string {
	const opens: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
	const openChars = new Set(Object.keys(opens));
	const closeChars = new Set(Object.values(opens));

	const isEscaped = (s: string, pos: number): boolean => {
		let k = pos - 1;
		let count = 0;
		while (k >= 0 && s[k] === '\\') {
			count++;
			k--;
		}
		return count % 2 === 1;
	};

	// Helper: find end of quote starting at `start` (handles escapes)
	const findQuoteEnd = (s: string, start: number): number => {
		const quote = s[start];
		let j = start + 1;
		while (j < s.length) {
			// if this quote char is not escaped, it's the end
			if (s[j] === quote && !isEscaped(s, j)) return j;
			// if an unescaped backslash, skip next char
			if (s[j] === '\\' && !isEscaped(s, j)) {
				j += 2;
				continue;
			}
			j++;
		}
		return -1;
	};

	// Find matching closing bracket for bracket at `start`.
	// Skips escaped characters and quoted subsections.
	const findMatchingBracket = (s: string, start: number): number => {
		const opening = s[start];
		const expectedStack: string[] = [opens[opening]];
		let j = start + 1;
		while (j < s.length) {
			const ch = s[j];

			// if this char is escaped (i.e. preceded by an odd number of backslashes), treat literal
			if (isEscaped(s, j)) {
				j++;
				continue;
			}

			// handle unescaped backslash: skip next char
			if (ch === '\\') {
				j += 2;
				continue;
			}

			// skip quoted sections inside brackets (only if quote is not escaped)
			if ((ch === '"' || ch === "'") && !isEscaped(s, j)) {
				const qend = findQuoteEnd(s, j);
				if (qend === -1) {
					j++;
				} else {
					j = qend + 1;
				}
				continue;
			}

			// opening bracket -> push its closer (only if not escaped)
			if (openChars.has(ch) && !isEscaped(s, j)) {
				expectedStack.push(opens[ch]);
				j++;
				continue;
			}

			// closing bracket -> check stack top (only if not escaped)
			if (closeChars.has(ch) && !isEscaped(s, j)) {
				if (
					expectedStack.length > 0 &&
					ch === expectedStack[expectedStack.length - 1]
				) {
					expectedStack.pop();
					if (expectedStack.length === 0) return j;
				}
			}

			j++;
		}
		return -1;
	};

	let i = 0;
	const out: string[] = [];
	while (i < input.length) {
		const ch = input[i];

		// If this char is escaped, copy literally
		if (isEscaped(input, i)) {
			out.push(ch);
			i++;
			continue;
		}

		// Preserve escaped pair as-is (backslash + next char)
		if (ch === '\\') {
			if (i + 1 < input.length) {
				out.push(ch, input[i + 1]);
				i += 2;
			} else {
				out.push(ch);
				i++;
			}
			continue;
		}

		// Quotes: replace entire quoted segment (including delimiters) with spaces
		if ((ch === '"' || ch === "'") && !isEscaped(input, i)) {
			const qend = findQuoteEnd(input, i);
			if (qend === -1) {
				// unclosed quote -> replace quote char with a space and continue
				out.push(' ');
				i++;
			} else {
				const len = qend - i + 1;
				for (let k = 0; k < len; k++) out.push(' ');
				i = qend + 1;
			}
			continue;
		}

		// Opening brackets: replace entire bracketed segment with spaces
		if (openChars.has(ch) && !isEscaped(input, i)) {
			const bend = findMatchingBracket(input, i);
			if (bend === -1) {
				out.push(ch);
				i++;
			} else {
				const len = bend - i + 1;
				for (let k = 0; k < len; k++) out.push(' ');
				i = bend + 1;
			}
			continue;
		}

		// Normal character -> keep
		out.push(ch);
		i++;
	}
	return out.join('');
}

/**
 * If `input` starts with an unescaped `(…)` block (after optional leading
 * operator characters and whitespace), replace the outer parentheses with
 * quote characters so that the regex parser can handle the content as a
 * quoted string.
 *
 * The replacement quote is chosen to avoid conflicting with quotes already
 * present inside the parentheses:
 * - No inner double quotes → use `"`
 * - Inner double quotes but no single quotes → use `'`
 * - Both quote types present → leave unchanged
 *
 * This is needed because the regex engine cannot handle arbitrarily nested
 * parentheses, but can handle quoted strings.
 *
 * @param input - The string to process, typically the tail of the input from
 *   the `::` expression delimiter onward.
 * @returns The (possibly rewritten) string.
 */
export function replaceLeadingWrappedParenthesesWithQuotes(
	input: string,
): string {
	// skip initial non-alphanumeric chars (unless escaped)
	let i = 0;
	while (i < input.length) {
		if (isEscaped(input, i)) break;
		if (!/[:@#\*]/.test(input[i])) break;
		i++;
	}
	// skip spaces after them (unless escaped)
	while (i < input.length && input[i] === ' ' && !isEscaped(input, i)) i++;

	if (i >= input.length) return input;

	// next must be an unescaped opening parenthesis
	if (input[i] !== '(' || isEscaped(input, i)) return input;

	// helper: find end of quote starting at `start` (handles escapes)
	const findQuoteEnd = (s: string, start: number): number => {
		const quote = s[start];
		let j = start + 1;
		while (j < s.length) {
			if (s[j] === quote && !isEscaped(s, j)) return j;
			if (s[j] === '\\' && !isEscaped(s, j)) {
				j += 2;
				continue;
			}
			j++;
		}
		return -1;
	};

	// find matching closing parenthesis handling nesting, quotes and escapes
	const findMatchingParen = (s: string, start: number): number => {
		let depth = 1;
		let j = start + 1;
		while (j < s.length) {
			if (isEscaped(s, j)) {
				j++;
				continue;
			}
			const ch = s[j];
			if (ch === '\\') {
				j += 2;
				continue;
			}
			if (ch === '"' || ch === "'") {
				const qend = findQuoteEnd(s, j);
				j = qend === -1 ? j + 1 : qend + 1;
				continue;
			}
			if (ch === '(') {
				depth++;
			} else if (ch === ')') {
				depth--;
				if (depth === 0) return j;
			}
			j++;
		}
		return -1;
	};

	const bend = findMatchingParen(input, i);
	if (bend === -1) return input; // no matching closer -> unchanged

	// helper: test for unescaped presence of a char inside range [a,b)
	const hasUnescaped = (
		s: string,
		a: number,
		b: number,
		chTest: string,
	): boolean => {
		for (let k = a; k < b; k++) {
			if (s[k] === chTest && !isEscaped(s, k)) return true;
			if (s[k] === '\\' && !isEscaped(s, k)) k++; // skip next
		}
		return false;
	};

	const innerStart = i + 1;
	const innerEnd = bend;
	const hasDouble = hasUnescaped(input, innerStart, innerEnd, '"');
	const hasSingle = hasUnescaped(input, innerStart, innerEnd, "'");

	// decide replacement char:
	// - if no double quotes inside -> use double quotes
	// - else if double inside but no single inside -> use single quotes
	// - else (both present) -> leave input unchanged
	let replacementQuote: string | null = null;
	if (!hasDouble) replacementQuote = '"';
	else if (hasDouble && !hasSingle) replacementQuote = "'";
	else return input;

	// construct result: keep everything, but replace outer '(' and ')' with the chosen quote
	return (
		input.slice(0, i) +
		replacementQuote +
		input.slice(innerStart, innerEnd) +
		replacementQuote +
		input.slice(bend + 1)
	);
}
