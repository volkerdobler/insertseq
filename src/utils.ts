import * as vscode from 'vscode';
import { TParameter, TSpecialReplacementValues } from './types';
import { safeEvaluate } from './safeEval';

// internal console.log command, if debug is true
let debugInsertseq = false;

let outputChannel: vscode.OutputChannel | null = null;

export function setOutputChannel(name: string): void {
	outputChannel = vscode.window.createOutputChannel(name);
}

export function removeOutputChannel(): void {
	if (outputChannel) {
		outputChannel.dispose();
		outputChannel = null;
	}
}

export function setDebugMode(enabled: boolean): void {
	debugInsertseq = debugInsertseq || enabled;
}

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

export function getStopExpression(
	input: string,
	parameter: TParameter,
): string {
	const parameterStopexpr = input.match(parameter.segments['stopexpression']);
	return parameterStopexpr?.groups?.stopexpr
		? parameterStopexpr.groups.indoublequotes ||
				parameterStopexpr.groups.insinglequotes ||
				parameterStopexpr.groups.inbrackets ||
				parameterStopexpr.groups.stopexpr ||
				''
		: '';
}

export function getExpression(input: string, parameter: TParameter): string {
	const parameterExpression = input.match(parameter.segments['expression']);
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
		if (exprResult) {
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
			Number(para.currentValueStr)
				? para.currentValueStr
				: `'${para.currentValueStr}'`,
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

function removePairedAndQuoted(input: string): string {
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
