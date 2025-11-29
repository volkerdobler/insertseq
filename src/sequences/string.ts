import * as formatting from '../formatting';
import { TParameter, TSpecialReplacementValues } from '../types';
import {
	printToConsole,
	replaceSpecialChars,
	runExpression,
	getStepValue,
	getFrequencyValue,
	getRepeatValue,
	getStartOverValue,
	getStopExpression,
	checkStopExpression,
	getExpression,
} from '../utils';

export function createStringSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// utility functions for string to index and index to string conversion - unicode-graphem aware
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

		// all combinations with fewer characters
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
			if (index < count + combinations) {
				break;
			}
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

	// extract start value as regex group to allow lowercase/uppercase detection
	const startRegEx = new RegExp(parameter.segments['start_alpha'], 'i');
	const startMatch = input.match(startRegEx);

	const start = startMatch?.groups?.start || '';

	// default return if start is empty
	const defaultReturn = { stringFunction: '', stopFunction: true };
	if (start === '') {
		return (_) => defaultReturn;
	}

	// extract steps, repetition, frequency, startover, stop expression, expression and format
	const step = getStepValue(input, parameter, 'steps_other');
	const freq = getFrequencyValue(input, parameter);
	const repe = getRepeatValue(input, parameter);
	const startover = getStartOverValue(input, parameter);
	const stopexpr = getStopExpression(input, parameter);
	const expr = getExpression(input, parameter);
	const format =
		input.match(parameter.segments['format_alpha'])?.groups?.format_alpha ||
		String(parameter.config.get('stringFormat')) ||
		'';

	// determine capitalization, default: preserve original capitalization (from rightmost characters)
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

	// then check input capitalization options
	switch (String(startMatch?.groups?.alphacapital).toLocaleLowerCase()) {
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

	// check alphabet for unique entries
	const uniqAlphabet = new Set(alphabetArr);
	if (uniqAlphabet.size !== alphabetArr.length) {
		throw new Error('Alphabet includes double entries!');
	}

	const charToIndex = new Map<string, number>();
	// Build mapping that accepts both lower/upper input forms but keeps alphabetArr as canonical output values
	alphabetArr.forEach((char: string, i: number) => {
		charToIndex.set(char, i);
		const lower = char.toLowerCase();
		const upper = char.toUpperCase();
		if (!charToIndex.has(lower)) {
			charToIndex.set(lower, i);
		}
		if (!charToIndex.has(upper)) {
			charToIndex.set(upper, i);
		}
	});
	const alphabetLen = alphabetArr.length;

	// prepare special replacement values for expressions and stop expressions
	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '',
		previousValueStr: '0',
		currentIndexStr: '',
		origTextStr: '',
		startStr: start.toString() || parameter.config.get('start') || '1',
		stepStr: step.toString() || parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
	};

	// get current index of start string
	const currentIndex = stringToIndex(start);

	// return the sequence function (i = current index of insertion, starting with 0)
	return (i) => {
		if (i <= parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		} else {
			replacableValues.origTextStr = '';
		}

		// set current index string
		replacableValues.currentIndexStr = i.toString();

		// calculate current value based on start, step, frequency, repetition and startover
		let value = indexToString(
			currentIndex +
				step * Math.trunc(((i % startover) % (freq * repe)) / freq),
		);

		replacableValues.valueAfterExpressionStr = '';

		// set current value string before expression evaluation
		replacableValues.currentValueStr = value;

		// if expression does not lead to a string, the current / new value will not be changed
		try {
			let tempValue = runExpression(
				replaceSpecialChars(expr, replacableValues),
			);
			if (typeof tempValue === 'string' || tempValue instanceof String) {
				value = String(tempValue);
			}
		} catch {
			printToConsole('Error evaluating expression for string sequence');
		}

		// set value after expression evaluation
		replacableValues.valueAfterExpressionStr = value;

		// default: stop expression triggered if i >= number of original selections
		let stopExprResult = i >= parameter.origCursorPos.length;

		// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
		if (stopexpr.length > 0) {
			stopExprResult = checkStopExpression(
				i,
				stopexpr,
				parameter.origCursorPos.length,
				replacableValues,
			);
		} else {
			stopExprResult = i >= parameter.origCursorPos.length;
		}

		// set previous value string for next iteration
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
				// preserve original capitalization (from rightmost characters)
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
