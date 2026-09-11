import { TParameter, TSpecialReplacementValues } from '../types';
import {
	printToConsole,
	runExpression,
	getStepValue,
	getFrequencyValue,
	getRepeatValue,
	getStartOverValue,
	getStopExpression,
	checkStopExpression,
	getExpression,
	getFormatExpression,
} from '../components/utils';
import * as formatting from '../formatting';

/**
 * Build the sequence function for predefined item sequences.
 *
 * Item lists are read from the `mysequences` configuration array. The input
 * can reference a list by number or by searching for a matching entry; the
 * search behaviour (case-insensitive, full-match, starts-with) is controlled
 * by the option flags `i`, `f`, and `s` in the `?…` options segment.
 *
 * @param input - Raw user input string beginning with `;` or `predefined:`.
 * @param parameter - Shared command context (must contain a valid `mysequences` config entry).
 * @returns A per-index function `(i) => { stringFunction, stopFunction }`.
 */
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

	parameter.myDelimiter = predefinedParameter?.groups?.seqdelimiter || null;

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

	const expr = getExpression(input, parameter);
	const format =
		getFormatExpression(input, parameter, 'format_alpha') ||
		String(parameter.config.get('stringFormat') || '') ||
		'';
	const centerString =
		String(parameter.config.get('centerString') || '') || '';

	return (i) => {
		replacableValues.currentIndexStr = i.toString();
		replacableValues.origTextStr =
			i < parameter.origTextSel.length ? parameter.origTextSel[i] : '';

		const rawIndex =
			start + step * Math.trunc(((i % startover) % (freq * repe)) / freq);
		const len = ownSeq.length;
		if (len === 0) {
			return { stringFunction: '', stopFunction: true };
		}
		const idx = ((rawIndex % len) + len) % len;

		replacableValues.currentValueStr = ownSeq[idx];
		replacableValues.valueAfterExpressionStr = '';

		let value = replacableValues.currentValueStr;
		const toNumOrStr = (v: string): number | string => {
			if (typeof v !== 'string' || v.trim() === '') {
				return v;
			}
			const num = Number(v);
			return Number.isFinite(num) ? num : v;
		};

		try {
			let exprResult = runExpression(expr, {
				_: toNumOrStr(value),
				i: i,
				n: parameter.origCursorPos.length,
				s: step,
				a: toNumOrStr(replacableValues.startStr),
				p: toNumOrStr(replacableValues.previousValueStr),
				o: replacableValues.origTextStr,
				c: '',
			});
			if (
				typeof exprResult === 'string' ||
				exprResult instanceof String
			) {
				value = String(exprResult);
			} else if (
				exprResult !== null &&
				typeof exprResult !== 'undefined'
			) {
				value = String(exprResult);
			}
		} catch {
			printToConsole(
				'Error evaluating expression for predefined sequence',
			);
		}

		replacableValues.valueAfterExpressionStr = value;

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

		replacableValues.previousValueStr = value;

		return {
			stringFunction: formatting.formatString(
				value,
				format,
				centerString,
			),
			stopFunction: stopExprResult,
		};
	};
}
