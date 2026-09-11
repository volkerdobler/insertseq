import * as formatting from '../formatting';
import { TParameter, TSpecialReplacementValues } from '../types';
import {
	printToConsole,
	getExpression,
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
		String(parameter.config.get('stringFormat') || '') ||
		'';
	const centerString =
		String(parameter.config.get('centerString') || '') || '';

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
		const toNumOrStr = (v: string): number | string => {
			if (typeof v !== 'string' || v.trim() === '') {
				return v;
			}
			const num = Number(v);
			return Number.isFinite(num) ? num : v;
		};

		const context: Record<string, unknown> = {
			_: toNumOrStr(value),
			i: i,
			n: parameter.origCursorPos.length,
			s: Number(parameter.config.get('step')) || 1,
			a: toNumOrStr(String(parameter.config.get('start') || '1')),
			p: toNumOrStr(parameter.origTextSel[i - 1] || ''),
			o: parameter.origTextSel[i] || '',
			c: '',
		};

		// if expression exists, evaluate expression with current Value and replace newValue with result of expression.
		try {
			let exprResult = runExpression(expr, context);
			if (exprResult !== null && typeof exprResult !== 'undefined') {
				value = String(exprResult);
			}
		} catch {
			printToConsole(
				'Error evaluating expression for text selected sequence',
			);
		}

		return {
			stringFunction: formatting.formatString(
				value,
				format,
				centerString,
			),
			stopFunction: i >= parameter.origCursorPos.length,
		};
	};
}
