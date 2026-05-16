import * as formatting from '../formatting';
import { TParameter, TSpecialReplacementValues } from '../types';
import {
	printToConsole,
	getExpression,
	getInputPart,
	replaceSpecialChars,
	runExpression,
	getFormatExpression,
} from '../components/utils';

/**
 * Build the sequence function that re-inserts the originally selected text.
 *
 * Used when the input box is left empty and text was selected before the
 * command was invoked. An optional `::expr` can transform each selection
 * before re-insertion, and `~format` applies string padding/alignment.
 *
 * @param input - Raw user input string (typically empty or format/expression only).
 * @param parameter - Shared command context.
 * @returns A per-index function `(i) => { stringFunction, stopFunction }`.
 */
export function createTextSelectedSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	const expr = getExpression(input, parameter);
	const format =
		getFormatExpression(input, parameter, 'format_alpha') ||
		String(parameter.config.get('stringFormat')) ||
		'';

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '', // only for stopexpression
		previousValueStr: '',
		currentIndexStr: '',
		origTextStr: '',
		startStr: parameter.config.get('start') || '1',
		stepStr: parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
	};

	return (i) => {
		let value = parameter.origTextSel[i] || '';

		replacableValues.origTextStr = parameter.origTextSel[i];
		replacableValues.currentIndexStr = i.toString();
		replacableValues.currentValueStr = value;
		replacableValues.valueAfterExpressionStr = '';

		// if expression exists, evaluate expression with current Value and replace newValue with result of expression.
		try {
			let exprResult = runExpression(
				replaceSpecialChars(expr, replacableValues),
			);
			if (
				typeof exprResult === 'string' ||
				exprResult instanceof String
			) {
				value = String(exprResult);
			}
		} catch {
			printToConsole(
				'Error evaluating expression for text selected sequence',
			);
		}

		return {
			stringFunction: formatting.formatString(value, format),
			stopFunction: i >= parameter.origCursorPos.length,
		};
	};
}
