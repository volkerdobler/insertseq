import { TParameter, TSpecialReplacementValues } from '../types';
import * as formatting from '../formatting';
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

export function createDecimalSeq(
	input: string,
	parameter: TParameter,
	base: number,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// extract parameters from input string or use configuration defaults
	const startMatch = input.match(parameter.segments['start_decimal']);

	// extract start value (with possible decimals), random number and delimiter
	const start =
		Number(startMatch?.groups?.start ?? parameter.config.get('start')) ?? 1;
	const startDecimals =
		startMatch?.groups?.startDecimals1 ||
		startMatch?.groups?.startDecimals2 ||
		'';
	const randomNumber = Number(startMatch?.groups?.rndNumber) || 0;
	const randomDecimal = startMatch?.groups?.rndDecimals || '';
	const randomPlusMinus = startMatch?.groups?.rndPlusMinus || null;
	const leadString = startMatch?.groups?.lead_string;
	const randomAvailable = startMatch?.groups?.rndAvailable || null;

	const myDelimiter = startMatch?.groups?.seqdelimiter || null;

	// set custom delimiter if given in input
	parameter.myDelimiter = myDelimiter;

	// extract steps, repetition, frequency, startover, stop expression and expression
	const step = getStepValue(input, parameter, 'steps_decimal');
	const freq = getFrequencyValue(input, parameter);
	const repe = getRepeatValue(input, parameter);
	const startover = getStartOverValue(input, parameter);
	const stopexpr = getStopExpression(input, parameter);
	const expr = getExpression(input, parameter);

	// determine if radix prefix is requested
	const radixPrefix =
		base !== 10
			? startMatch?.groups?.radixPrefix !== undefined
				? String(startMatch?.groups?.radixPrefix) === '1'
				: parameter.config.get('radixPrefix') !== undefined
					? parameter.config.get('radixPrefix') === true
					: false
			: false;

	// determine format string based on base
	const basePrefix =
		base === 16 ? '#x' : base === 8 ? '#o' : base === 2 ? '#b' : '';

	// format string: leading string (if given) or radixPrefix if given or format from input or configuration or empty
	const format = leadString
		? leadString[0] + '>' + input.length
		: radixPrefix
			? basePrefix
			: String(
					input.match(parameter.segments['format_decimal'])?.groups
						?.format_decimal ??
						String(parameter.config.get('numberFormat')) ??
						'',
				);

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

	// return the sequence function (i = current index of insertion, starting with 0)
	return (i) => {
		let value = start;

		if (randomAvailable) {
			// generate random number based on given input
			const maxNumber =
				randomPlusMinus !== null
					? start + randomNumber
					: randomNumber > 0
						? randomNumber
						: start;

			// determine range for random number, startRandom must be smaller than stopRandom
			const startRandom = start < maxNumber ? start : maxNumber;
			const stopRandom = start < maxNumber ? maxNumber : start;

			// generate random number between start and maxNumber
			if (start <= maxNumber) {
				value = Number(
					Number(
						startRandom +
							Math.random() *
								(stopRandom -
									startRandom +
									0.5 * 10 ** (-randomDecimal.length - 1)),
					).toFixed(randomDecimal.length),
				);
			}
		} else {
			// calculate current value based on start, step, frequency, repetition and startover
			value =
				start +
				step * Math.trunc(((i % startover) % (freq * repe)) / freq);
		}

		// set special replacement values for origTextStr and currentIndexStr
		if (i <= parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		}
		replacableValues.currentIndexStr = i.toString();

		// set current value string before expression evaluation
		replacableValues.currentValueStr = value.toString(base);
		replacableValues.valueAfterExpressionStr = '';

		// if expression exists, evaluate expression with current Value and replace newValue with result of expression.
		// if expression does not lead to a number, the current / new value will not be changed
		try {
			let exprResult = runExpression(
				replaceSpecialChars(expr, replacableValues),
			);
			if (Number.isFinite(exprResult)) {
				value = Number(exprResult);
			}
		} catch {
			// ignore errors in expression evaluation - keep current value;
			printToConsole('Error evaluating expression for decimal sequence');
		}

		// set value after expression evaluation
		replacableValues.valueAfterExpressionStr = value.toString(base);

		// default: stop expression triggered if i >= number of original selections
		let stopExpressionTriggered = i >= parameter.origCursorPos.length;

		// check stop expression if given
		if (stopexpr.length > 0) {
			// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
			stopExpressionTriggered = checkStopExpression(
				i,
				stopexpr,
				parameter.origCursorPos.length,
				replacableValues,
			);
		} else {
			stopExpressionTriggered = i >= parameter.origCursorPos.length;
		}

		// set previous value string for next iteration
		replacableValues.previousValueStr = value.toString();

		// apply formatting if format string is given and return formatted value
		if (format && format !== '') {
			return {
				stringFunction: formatting.formatNumber(value, format),
				stopFunction: stopExpressionTriggered,
			};
		} else {
			if (startDecimals === '') {
				let prefixStr = '';
				if (radixPrefix) {
					switch (base) {
						case 16:
							prefixStr = '0x';
							break;
						case 8:
							prefixStr = '0o';
							break;
						case 2:
							prefixStr = '0b';
							break;
					}
				}
				return {
					stringFunction: prefixStr + value.toString(base),
					stopFunction: stopExpressionTriggered,
				};
			} else {
				return {
					stringFunction: value.toFixed(startDecimals.length),
					stopFunction: stopExpressionTriggered,
				};
			}
		}
	};
}
