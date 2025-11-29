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

export function createPredefinedSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	type StartsOptions = {
		ignoreCase?: boolean;
		emptyMatchesAll?: boolean;
		fullMatch?: boolean;
		startsWith?: boolean;
	};

	function arrayIncludesString(
		x: string,
		a: string[],
		options?: StartsOptions,
	): number {
		const {
			ignoreCase = false,
			emptyMatchesAll = false,
			fullMatch = false,
			startsWith = false,
		} = options || {};

		if (x == null) {
			return -1;
		}
		if (x.length === 0 && !emptyMatchesAll) {
			return -1;
		}

		switch (true) {
			case fullMatch && ignoreCase:
				return a.findIndex(
					(s) => s.toLocaleLowerCase() === x.toLocaleLowerCase(),
				);
			case ignoreCase:
				return a.findIndex((s) =>
					s.toLocaleLowerCase().startsWith(x.toLocaleLowerCase()),
				);
			case fullMatch:
				return a.findIndex((s) => s === x);
			case startsWith:
				return a.findIndex((s) => s.startsWith(x));
			default:
				return a.findIndex((s) => s.includes(x));
		}
	}

	const predefinedSeq: string[][] = parameter.config.get('mysequences') || [
		[],
	];

	const predefinedParameter = input.match(
		parameter.segments['start_predefined'],
	);
	// if start_predefined group exists, extract sequence text (could be within quotes or plain text)
	const sequenceText = predefinedParameter?.groups?.start_predefined
		? predefinedParameter.groups.indoublequotes ||
			predefinedParameter.groups.insinglequotes ||
			predefinedParameter.groups.inbrackets ||
			predefinedParameter.groups.start_predefined ||
			''
		: '';
	const sequenceOptions = predefinedParameter?.groups?.predefinedopts || '';

	const searchOptions: StartsOptions = {
		ignoreCase: sequenceOptions.toLocaleLowerCase().indexOf('i') > -1,
		fullMatch: sequenceOptions.toLocaleLowerCase().indexOf('f') > -1,
		startsWith: sequenceOptions.toLocaleLowerCase().indexOf('s') > -1,
	};

	const parseDigits = sequenceOptions.match(/(\d+)(?:\|(\d+)?)?/);

	const sequenceNumber = parseInt(
		parseDigits && parseDigits.length > 0 ? parseDigits[1] : '0',
	);

	const sequenceStart =
		parseInt(
			parseDigits && parseDigits.length > 1 ? parseDigits[2] : '1',
		) || 1;

	let ownSeq: string[] = [];
	let start = 0;

	const step = getStepValue(input, parameter, 'steps_other');
	const freq = getFrequencyValue(input, parameter);
	const repe = getRepeatValue(input, parameter);
	const startover = getStartOverValue(input, parameter);
	const stopexpr = getStopExpression(input, parameter);

	if (sequenceText.length > 0) {
		if (sequenceNumber >= 1 && sequenceNumber <= predefinedSeq.length) {
			let index = arrayIncludesString(
				sequenceText,
				predefinedSeq[sequenceNumber - 1],
				searchOptions,
			);
			if (index > -1) {
				ownSeq = predefinedSeq[sequenceNumber - 1];
				start = index;
			}
		} else {
			for (let i = 0; i < predefinedSeq.length; i++) {
				let l = arrayIncludesString(
					sequenceText,
					predefinedSeq[i],
					searchOptions,
				);
				if (l > -1) {
					ownSeq = predefinedSeq[i];
					start = l;
					break;
				}
			}
		}
	} else {
		if (sequenceNumber >= 1 && sequenceNumber <= predefinedSeq.length) {
			ownSeq = predefinedSeq[sequenceNumber - 1];
			start = (sequenceStart - 1) % ownSeq.length;
		}
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
			ownSeq[
				(start +
					step *
						Math.trunc(((i % startover) % (freq * repe)) / freq)) %
					ownSeq.length
			];

		replacableValues.valueAfterExpressionStr =
			replacableValues.currentValueStr;

		if (ownSeq.length === 0) {
			return { stringFunction: '', stopFunction: true };
		} else {
			// calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
			let stopExprTrigger = i >= parameter.origCursorPos.length;
			if (stopexpr.length > 0) {
				stopExprTrigger = checkStopExpression(
					i,
					stopexpr,
					parameter.origCursorPos.length,
					replacableValues,
				);
			} else {
				stopExprTrigger = i >= parameter.origCursorPos.length;
			}

			replacableValues.previousValueStr =
				replacableValues.currentValueStr;

			return {
				stringFunction: replacableValues.currentValueStr,
				stopFunction: stopExprTrigger,
			};
		}
	};
}
