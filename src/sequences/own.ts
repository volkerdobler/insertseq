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

export function createOwnSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	const sequenceSet =
		input.match(parameter.segments['start_own'])?.groups?.ownseq || '';

	const start =
		parseInt(
			input.match(parameter.segments['start_own'])?.groups?.startseq ||
				'1',
		) || 1;
	const step = getStepValue(input, parameter, 'steps_other');
	const freq = getFrequencyValue(input, parameter);
	const repe = getRepeatValue(input, parameter);
	const startover = getStartOverValue(input, parameter);
	const stopexpr = getStopExpression(input, parameter);
	const expr = getExpression(input, parameter);

	const format =
		input.match(parameter.segments['format_alpha'])?.groups?.format_alpha ||
		'';

	let ownSeq: string[] = [];

	if (sequenceSet.length > 0) {
		ownSeq = sequenceSet
			.split(/\s*[;,]\s*/) // Split an Komma oder Semikolon mit optionalen Leerzeichen davor und danach
			.filter(Boolean); // Entfernt leere Strings, falls vorhanden
	}

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '', // only for stopexpression
		previousValueStr: '',
		currentIndexStr: '',
		origTextStr: '',
		startStr: start.toString() || parameter.config.get('start') || '1',
		stepStr: step.toString() || parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
	};

	return (i) => {
		replacableValues.currentIndexStr = i.toString();
		replacableValues.origTextStr =
			i < parameter.origTextSel.length ? parameter.origTextSel[i] : '';
		replacableValues.currentValueStr =
			i < ownSeq.length
				? ownSeq[
						(start -
							1 +
							step *
								Math.trunc(
									((i % startover) % (freq * repe)) / freq,
								)) %
							ownSeq.length
					]
				: '';

		replacableValues.valueAfterExpressionStr =
			replacableValues.currentValueStr;

		if (ownSeq.length === 0) {
			return { stringFunction: '', stopFunction: true };
		} else {
			// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
			let stopExprResult = i >= parameter.origCursorPos.length;
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
				replacableValues.currentValueStr;

			return {
				stringFunction: formatting.formatString(
					ownSeq[
						(start -
							1 +
							step *
								Math.trunc(
									((i % startover) % (freq * repe)) / freq,
								)) %
							ownSeq.length
					] || '',
					format,
				),
				stopFunction: stopExprResult,
			};
		}
	};
}
