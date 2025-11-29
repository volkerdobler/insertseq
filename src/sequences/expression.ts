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

export function createExpressionSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// check if valid expression is given
	const expressionMatch = input.match(parameter.segments['start_expression']);
	if (!expressionMatch) {
		const retFunction = { stringFunction: '', stopFunction: true };
		return (_) => retFunction;
	}

	// extract expression, if in quotes or brackets remove them
	const expr = expressionMatch?.groups?.start
		? expressionMatch.groups.indoublequotes ||
			expressionMatch.groups.insinglequotes ||
			expressionMatch.groups.inbrackets ||
			expressionMatch.groups.stopexpr ||
			''
		: '';
	// extract stop expression
	const stopexpr = getStopExpression(input, parameter);

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

	// return function for each index/item
	return (i) => {
		if (i <= parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
			// set current value to original selection text for use in expression
			replacableValues.currentValueStr = parameter.origTextSel[i];
		}

		replacableValues.valueAfterExpressionStr = '';
		replacableValues.currentIndexStr = i.toString();

		try {
			const exprResult = runExpression(
				replaceSpecialChars(expr, replacableValues),
			);
			if (
				typeof exprResult === 'string' ||
				exprResult instanceof String
			) {
				replacableValues.currentValueStr = String(exprResult);
			} else if (typeof exprResult === 'number') {
				replacableValues.currentValueStr = exprResult.toString();
			} else if (parameter.origTextSel[i].length === 0) {
				replacableValues.currentValueStr = (i + 1).toString();
			}
		} catch {
			printToConsole(
				'Error evaluating expression for expression sequence',
			);
		}

		// set value after expression evaluation (not different from current value here, but for consistency, but to work with stopexpr)
		replacableValues.valueAfterExpressionStr =
			replacableValues.currentValueStr;

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

		replacableValues.previousValueStr =
			replacableValues.valueAfterExpressionStr;

		return {
			stringFunction: replacableValues.currentValueStr,
			stopFunction: stopExprResult,
		};
	};
}
