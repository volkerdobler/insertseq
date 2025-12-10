import * as vscode from 'vscode';
import { TParameter, TSpecialReplacementValues } from './types';
import { safeEvaluate } from './safeEval';

// global debug flag
let debugInsertseq = false;

// output channel for debug messages
let outputChannel: vscode.OutputChannel | null = null;

// functions to manage output channel
export function setOutputChannel(name: string): void {
	outputChannel = vscode.window.createOutputChannel(name);
}

// dispose output channel
export function removeOutputChannel(): void {
	if (outputChannel) {
		outputChannel.dispose();
		outputChannel = null;
	}
}

// set debug mode (depends on global flag and configuration)
export function setDebugMode(enabled: boolean): void {
	debugInsertseq = debugInsertseq || enabled;
}

// print debug message to output channel or console
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

export function getRepeatValue(input: string, parameter: TParameter): number {
	const stripInput = clearInput(input);

	return (
		Number(
			stripInput.match(parameter.segments['repetition'])?.groups
				?.repeat ?? parameter.config.get('repetition'),
		) || Number.MAX_SAFE_INTEGER
	);
}

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

export function getInputPart(input: string, regExpr: RegExp): string {
	const maskedInput = maskPairedAndQuoted(input);
	const startIndex = maskedInput.search(regExpr);
	if (startIndex === -1) {
		return '';
	}
	return input.slice(startIndex);
}

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

export function getExpression(input: string, parameter: TParameter): string {
	const maskedInput = maskPairedAndQuoted(input);
	const startIndex = maskedInput.search(
		new RegExp(parameter.segments['charStartExpression'], 'i'),
	);
	if (startIndex === -1) {
		return '';
	}

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
		.replace(
			/\b_\b/gi,
			// Number(para.currentValueStr)
			// 	? para.currentValueStr
			// 	: `'${para.currentValueStr}'`,
			`'${para.currentValueStr}'`,
		)
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

export function runExpression(str: string): any {
	// strip surrounding quotes
	if (!str || str.length === 0) return null;
	if (str[0] === '"' && str[str.length - 1] === '"') {
		str = str.slice(1, -1);
	}
	if (str[0] === "'" && str[str.length - 1] === "'") {
		str = str.slice(1, -1);
	}

	// lightweight debug output (extension's printToConsole isn't available here)
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
