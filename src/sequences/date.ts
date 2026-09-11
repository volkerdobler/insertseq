import { Temporal } from 'temporal-polyfill';
import * as formatting from '../formatting';
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
	getInputPart,
	getExpression,
} from '../components/utils';

/**
 * Build the sequence function for date sequences.
 *
 * The start date is extracted from the input (defaulting to today when absent).
 * Each value is offset from the start by `i * step` units, where the unit is
 * one of `d` (days), `w` (weeks), `m` (months), or `y` (years).
 *
 * The output format is controlled by the `~format` segment or the
 * `dateFormat` / `language` configuration entries.
 *
 * @param input - Raw user input string beginning with `%` or `date:`.
 * @param parameter - Shared command context.
 * @returns A per-index function `(i) => { stringFunction, stopFunction }`.
 */
export function createDateSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// if only "%" or "date:", without date digits, insert current date (plainDateISO to avoid colons in time)
	if (
		input.match(/^(?:%|date:)(?!\d)/i) &&
		!input.match(/^(?:%|date:)\s*now\b/i)
	) {
		const prefix = input.match(/^(?:%|date:)/i)?.[0] || '%';
		input =
			prefix +
			Temporal.Now.plainDateISO().toString() +
			input.slice(prefix.length);
	}
	// extract start date
	let start = input.match(parameter.segments['start_date'])?.groups?.start;

	const defaultReturn = { stringFunction: '', stopFunction: true };

	const startGroups = input.match(parameter.segments['start_date'])?.groups;
	parameter.myDelimiter = startGroups?.seqdelimiter || null;

	let instant: Temporal.PlainDateTime;

	if (!start || start === '' || start.toLowerCase() === 'now') {
		instant = Temporal.Now.plainDateTimeISO();
		start = instant.toString();
	} else if (/^\d{1,2}:\d{1,2}(?::\d{1,2})?$/.test(start.trim())) {
		// Time-only string, e.g. 3:03 or 14:30:15 -> combine with today's date
		const todayStr = Temporal.Now.plainDateISO().toString();
		const timeParts = start.trim().split(':');
		const h = timeParts[0].padStart(2, '0');
		const m = timeParts[1].padStart(2, '0');
		const s = (timeParts[2] || '0').padStart(2, '0');
		const timeStr = `${h}:${m}:${s}`;
		try {
			instant = Temporal.PlainDateTime.from(`${todayStr}T${timeStr}`);
		} catch {
			instant = Temporal.Now.plainDateTimeISO();
		}
	} else {
		// Try parsing as ISO date-time or date
		const normalizedStart = start.trim().replace(' ', 'T');
		try {
			instant = Temporal.PlainDateTime.from(normalizedStart);
		} catch {
			try {
				const plainDate = Temporal.PlainDate.from(normalizedStart);
				instant = plainDate.toPlainDateTime({
					hour: 0,
					minute: 0,
					second: 0,
				});
			} catch {
				if (startGroups?.datepart) {
					let yearStr =
						startGroups.year ||
						Temporal.Now.plainDateISO().year.toString();
					if (yearStr.length === 2) {
						yearStr = parameter.config.get('century') + yearStr;
					}
					const year =
						Number(yearStr) || Temporal.Now.plainDateISO().year;
					const month =
						Number(startGroups.month) ||
						Temporal.Now.plainDateISO().month;
					const day =
						Number(startGroups.day) ||
						Temporal.Now.plainDateISO().day;
					instant = Temporal.PlainDateTime.from({
						year,
						month,
						day,
						hour: 0,
						minute: 0,
						second: 0,
					});
				} else {
					return (_) => defaultReturn;
				}
			}
		}
	}

	const stepsMatch = input.match(parameter.segments['steps_date']);
	const stepExpr = stepsMatch?.groups?.step_expr || '';
	const step = getStepValue(input, parameter, 'steps_date');
	const unit =
		stepsMatch?.groups?.date_unit ||
		parameter.config.get('dateStepUnit') ||
		'd';

	const compoundSteps: Array<{ amount: number; unit: string }> = [];
	const compoundRe =
		/([+-]?\d+(?:\.\d+)?)\s*(minute|minutes|second|seconds|hour|hours|day|days|week|weeks|month|months|year|years|min|sec|ms|[dDwWmMyYhHsS])/gi;
	let cMatch: RegExpExecArray | null;
	while ((cMatch = compoundRe.exec(stepExpr)) !== null) {
		const amt = parseFloat(cMatch[1]);
		if (!isNaN(amt)) {
			compoundSteps.push({ amount: amt, unit: cMatch[2] });
		}
	}

	const freq = getFrequencyValue(input, parameter);
	const repe = getRepeatValue(input, parameter);
	const startover = getStartOverValue(input, parameter);
	const stopexpr = getStopExpression(input, parameter);
	const expr = getExpression(input, parameter);

	const parameterFormatDate = getInputPart(
		input,
		new RegExp(parameter.segments['charStartFormat'], 'i'),
	).match(parameter.segments['format_date']);
	const format = parameterFormatDate?.groups?.dateformat
		? parameterFormatDate?.groups?.indoublequotes ||
			parameterFormatDate?.groups?.insinglequotes ||
			parameterFormatDate?.groups?.inbrackets ||
			parameterFormatDate?.groups?.dateformat ||
			''
		: String(parameter.config.get('dateFormat')) || '';
	const language =
		parameterFormatDate?.groups?.language ||
		parameter.config.get('language') ||
		undefined;

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '',
		previousValueStr: '',
		currentIndexStr: '',
		origTextStr: '',
		startStr: start.toString() || parameter.config.get('start') || '1',
		stepStr: step.toString() || parameter.config.get('step') || '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
	};

	return (i) => {
		function addSingleUnit(
			baseDate: Temporal.PlainDateTime,
			u: string,
			rawIdx: number,
		): Temporal.PlainDateTime {
			const uLower = u.toLowerCase();
			const abs = Math.abs(rawIdx);
			const sign = rawIdx >= 0 ? 1 : -1;

			let duration: {
				years?: number;
				months?: number;
				weeks?: number;
				days?: number;
				hours?: number;
				minutes?: number;
				seconds?: number;
				milliseconds?: number;
			} = {};

			if (Number.isInteger(abs)) {
				switch (uLower) {
					case 'w':
					case 'week':
					case 'weeks':
						duration = { weeks: abs };
						break;
					case 'm':
					case 'month':
					case 'months':
						duration = { months: abs };
						break;
					case 'y':
					case 'year':
					case 'years':
						duration = { years: abs };
						break;
					case 'h':
					case 'hour':
					case 'hours':
						duration = { hours: abs };
						break;
					case 'min':
					case 'minute':
					case 'minutes':
						duration = { minutes: abs };
						break;
					case 's':
					case 'sec':
					case 'second':
					case 'seconds':
						duration = { seconds: abs };
						break;
					case 'ms':
					case 'millisecond':
					case 'milliseconds':
						duration = { milliseconds: abs };
						break;
					case 'd':
					case 'day':
					case 'days':
					default:
						duration = { days: abs };
						break;
				}
			} else {
				// Convert float steps to smaller integer units
				switch (uLower) {
					case 'w':
					case 'week':
					case 'weeks':
						duration = { hours: Math.round(abs * 7 * 24) };
						break;
					case 'm':
					case 'month':
					case 'months':
						duration = { days: Math.round(abs * 30) };
						break;
					case 'y':
					case 'year':
					case 'years':
						duration = { days: Math.round(abs * 365) };
						break;
					case 'd':
					case 'day':
					case 'days':
						duration = { minutes: Math.round(abs * 24 * 60) };
						break;
					case 'h':
					case 'hour':
					case 'hours':
						duration = { minutes: Math.round(abs * 60) };
						break;
					case 'min':
					case 'minute':
					case 'minutes':
						duration = { seconds: Math.round(abs * 60) };
						break;
					case 's':
					case 'sec':
					case 'second':
					case 'seconds':
						duration = { milliseconds: Math.round(abs * 1000) };
						break;
					default:
						duration = { minutes: Math.round(abs * 24 * 60) };
						break;
				}
			}

			return sign >= 0
				? baseDate.add(duration)
				: baseDate.subtract(duration);
		}

		function calculateDateOffset(
			baseDate: Temporal.PlainDateTime,
			offset: number,
		): Temporal.PlainDateTime {
			const iterMultiplier = Math.trunc(
				((offset % startover) % (freq * repe)) / freq,
			);

			if (compoundSteps.length > 0) {
				let resultDate = baseDate;
				for (const cs of compoundSteps) {
					const totalAmt = cs.amount * step * iterMultiplier;
					resultDate = addSingleUnit(resultDate, cs.unit, totalAmt);
				}
				return resultDate;
			}

			const rawIdx = step * iterMultiplier;
			return addSingleUnit(baseDate, unit, rawIdx);
		}

		if (i < parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		} else {
			replacableValues.origTextStr = '';
		}
		replacableValues.currentIndexStr = i.toString();

		let value = calculateDateOffset(instant, i);

		replacableValues.valueAfterExpressionStr = '';
		replacableValues.currentValueStr = formatting.formatTemporalDateTime(
			value,
			format,
			language,
		);

		// if expression exists, evaluate expression with current Value and replace newValue with result of expression.
		try {
			const exprResult = runExpression(expr, {
				_: replacableValues.currentValueStr,
				i: i,
				n: parameter.origCursorPos.length,
				s: step,
				a: replacableValues.startStr,
				p: replacableValues.previousValueStr,
				o: replacableValues.origTextStr,
				c: '',
			});
			if (
				typeof exprResult === 'string' ||
				exprResult instanceof String
			) {
				value = Temporal.PlainDateTime.from(String(exprResult));
			}
		} catch {
			printToConsole('Error evaluating expression for date sequence');
		}
		replacableValues.valueAfterExpressionStr =
			formatting.formatTemporalDateTime(value, format, language);

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

		replacableValues.previousValueStr = formatting.formatTemporalDateTime(
			value,
			format,
			language,
		);

		return {
			stringFunction: formatting.formatTemporalDateTime(
				value,
				format,
				language,
			),
			stopFunction: stopExprResult,
		};
	};
}
