import { Temporal } from 'temporal-polyfill';
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
	getInputPart,
	getExpression,
} from '../utils';

export function createDateSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	// if only "%", without additional digits, is given, use current date as start date
	if (input.match(/^%(?!\d)/)) {
		input = '%' + Temporal.Now.plainDateISO().toString() + input.slice(1);
	}
	// extract start date
	let start = input.match(parameter.segments['start_date'])?.groups?.start;

	// if start date is empty, use current date
	if (start === '') {
		start = Temporal.Now.plainDateISO().toString();
	}

	// if no start date found, return empty function
	const defaultReturn = { stringFunction: '', stopFunction: true };
	if (!start) {
		return (_) => defaultReturn;
	}

	const startGroups = input.match(parameter.segments['start_date'])?.groups;

	const dateParts = { year: 0, month: 0, day: 0 };

	if (startGroups?.datepart) {
		let yearStr =
			input.match(parameter.segments['start_date'])?.groups?.year ||
			Temporal.Now.plainDateISO().year.toString();
		if (yearStr.length === 2) {
			yearStr = parameter.config.get('century') + yearStr;
		}
		dateParts.year = Number(yearStr) || Temporal.Now.plainDateISO().year;
		dateParts.month =
			Number(
				input.match(parameter.segments['start_date'])?.groups?.month,
			) || Temporal.Now.plainDateISO().month;
		dateParts.day =
			Number(
				input.match(parameter.segments['start_date'])?.groups?.day,
			) || Temporal.Now.plainDateISO().day;
	} else {
		// currently no valie date input - might change in the future
		// note: keep user-visible message in extension; printToConsole used for debugging
		return (_) => defaultReturn;
	}

	const step = getStepValue(input, parameter, 'steps_date');

	const unit =
		input.match(parameter.segments['steps_date'])?.groups?.date_unit ||
		parameter.config.get('date_unit') ||
		'd';

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

	const instant = Temporal.PlainDateTime.from({
		year: dateParts.year,
		month: dateParts.month,
		day: dateParts.day,
		hour: 0,
		minute: 0,
		second: 0,
		millisecond: 0,
		microsecond: 0,
		nanosecond: 0,
	});

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
		function calculateDateOffset(
			baseDate: Temporal.PlainDateTime,
			offset: number,
		): Temporal.PlainDateTime {
			let idx =
				step *
				Math.trunc(((offset % startover) % (freq * repe)) / freq);

			let value: Temporal.PlainDateTime;
			if (idx >= 0) {
				switch (unit.toLowerCase()) {
					case 'w':
						value = baseDate.add({ weeks: idx });
						break;
					case 'm':
						value = baseDate.add({ months: idx });
						break;
					case 'y':
						value = baseDate.add({ years: idx });
						break;
					default:
						value = baseDate.add({ days: idx });
						break;
				}
			} else {
				switch (unit.toLowerCase()) {
					case 'w':
						value = baseDate.subtract({
							weeks: Math.abs(idx),
						});
						break;
					case 'm':
						value = baseDate.subtract({
							months: Math.abs(idx),
						});
						break;
					case 'y':
						value = baseDate.subtract({
							years: Math.abs(idx),
						});
						break;
					default:
						value = baseDate.subtract({
							days: Math.abs(idx),
						});
						break;
				}
			}

			return value;
		}

		if (i <= parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		} else {
			replacableValues.origTextStr = '';
		}
		replacableValues.currentIndexStr = i.toString();

		let value = calculateDateOffset(instant, i);

		replacableValues.valueAfterExpressionStr = '';
		replacableValues.currentValueStr = value
			.toPlainDate()
			.toLocaleString(language);

		// if expression exists, evaluate expression with current Value and replace newValue with result of expression.
		try {
			let exprResult = runExpression(
				replaceSpecialChars(expr, replacableValues),
			);
			if (
				typeof exprResult === 'string' ||
				exprResult instanceof String
			) {
				const tempDate = Temporal.PlainDate.from(String(exprResult));
				value = Temporal.PlainDateTime.from({
					year: tempDate.year,
					month: tempDate.month,
					day: tempDate.day,
					hour: 0,
					minute: 0,
					second: 0,
					millisecond: 0,
					microsecond: 0,
					nanosecond: 0,
				});
			}
		} catch {
			printToConsole('Error evaluating expression for date sequence');
		}
		replacableValues.valueAfterExpressionStr = value
			.toPlainDate()
			.toLocaleString(language);

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

		replacableValues.previousValueStr = value
			.toPlainDate()
			.toLocaleString(language);

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
