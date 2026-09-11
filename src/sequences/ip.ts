import { TParameter, TSpecialReplacementValues } from '../types';
import {
	formatString,
	ipToNumber,
	numberToIp,
	numberToBinaryIp,
	numberToHexIp,
} from '../formatting';
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

export { ipToNumber, numberToIp, numberToBinaryIp, numberToHexIp };

/**
 * Build the sequence function for IPv4 network and host address sequences.
 *
 * Supported formats / modifiers:
 * - \`192.168.1.1:1\` - increments host address (192.168.1.1, 192.168.1.2, ...)
 * - \`192.168.1.255:1\` - rolls over subnet boundaries (192.168.2.0)
 * - \`10.0.0.1/24:1\` - preserves CIDR suffix (10.0.0.1/24, 10.0.0.2/24, ...)
 * - \`10.0.1.0:-1\` - negative steps (10.0.0.255)
 * - \`~0\` / \`~pad\` - zero-padded octets (192.168.001.001)
 * - \`~hex\` / \`~x\` - 8-character lowercase hex (c0a80101)
 * - \`~HEX\` / \`~X\` - 8-character uppercase hex (C0A80101)
 * - \`~bin\` / \`~b\` - dotted binary notation (11000000.10101000.00000001.00000001)
 * - \`~int\` / \`~d\` - 32-bit unsigned integer (3232235777)
 * - \`:ip\` / \`:ip:1\` - default start address 192.168.1.1
 *
 * @param input - Raw user input string.
 * @param parameter - Shared command context.
 * @returns A per-index function (i) => { stringFunction, stopFunction }.
 */
export function createIpSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	const startMatch = input.match(parameter.segments['start_ip']);
	parameter.myDelimiter = startMatch?.groups?.seqdelimiter || null;

	const rawIp = startMatch?.groups?.ipAddress;
	const inputCidr = startMatch?.groups?.cidr || '';

	// Default start IP from settings if omitted (e.g. user entered `:ip` or `:ip:1`)
	const configIpStart =
		String(parameter.config.get('ipStart') || '192.168.1.1').trim() ||
		'192.168.1.1';
	let defaultIp = configIpStart;
	let defaultCidr = '';
	if (configIpStart.includes('/')) {
		const slashIndex = configIpStart.indexOf('/');
		defaultIp = configIpStart.slice(0, slashIndex);
		defaultCidr = configIpStart.slice(slashIndex);
	}

	const startIp = rawIp || defaultIp;
	const cidr = rawIp ? inputCidr : inputCidr || defaultCidr;

	// Check if input IP octets were zero-padded (e.g. 192.168.001.001)
	const isInputZeroPadded = rawIp
		? rawIp.split('.').some((o) => o.length > 1 && o.startsWith('0'))
		: false;

	const startNum = ipToNumber(startIp);
	const step = Math.trunc(getStepValue(input, parameter, 'steps_decimal'));
	const freq = getFrequencyValue(input, parameter);
	const repe = getRepeatValue(input, parameter);
	const startover = getStartOverValue(input, parameter);
	const stopexpr = getStopExpression(input, parameter);
	const expr = getExpression(input, parameter);

	// Extract format: ~0, ~hex, ~HEX, ~bin, ~int, or general format string
	const format = getFormatExpression(input, parameter, 'format_ip');

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '',
		previousValueStr: '',
		origTextStr: '',
		startStr: startIp + cidr,
		stepStr: step.toString(),
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
		currentIndexStr: '',
	};

	return (i: number) => {
		const stepOffset = Math.trunc(((i % startover) % (freq * repe)) / freq);
		const currentNum = (startNum + step * stepOffset) >>> 0;

		let formattedValue = '';

		const fmtLower = format.toLowerCase();
		if (fmtLower === 'hex' || fmtLower === 'x') {
			formattedValue = numberToHexIp(
				currentNum,
				format === 'HEX' || format === 'X',
			);
		} else if (fmtLower === 'bin' || fmtLower === 'b') {
			formattedValue = numberToBinaryIp(currentNum);
		} else if (fmtLower === 'int' || fmtLower === 'd') {
			formattedValue = currentNum.toString();
		} else if (format === '0' || fmtLower === 'pad' || isInputZeroPadded) {
			formattedValue = numberToIp(currentNum, true) + cidr;
		} else {
			formattedValue = numberToIp(currentNum, false) + cidr;
			if (format && format !== '') {
				formattedValue = formatString(formattedValue, format);
			}
		}

		if (i < parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		}
		replacableValues.currentIndexStr = i.toString();
		replacableValues.currentValueStr = formattedValue;
		replacableValues.valueAfterExpressionStr = '';

		// evaluate expression if given
		if (expr) {
			try {
				const exprResult = runExpression(expr, {
					_: formattedValue,
					i: i,
					n: parameter.origCursorPos.length,
					s: step,
					a: replacableValues.startStr,
					p: replacableValues.previousValueStr,
					o: replacableValues.origTextStr,
					c: '',
				});
				if (exprResult !== null && exprResult !== undefined) {
					formattedValue = String(exprResult);
				}
			} catch {
				printToConsole('Error evaluating expression for IP sequence');
			}
		}

		replacableValues.valueAfterExpressionStr = formattedValue;

		let stopExpressionTriggered = i >= parameter.origCursorPos.length;
		if (stopexpr.length > 0) {
			stopExpressionTriggered = checkStopExpression(
				i,
				stopexpr,
				parameter.origCursorPos.length,
				replacableValues,
			);
		}

		replacableValues.previousValueStr = formattedValue;

		return {
			stringFunction: formattedValue,
			stopFunction: stopExpressionTriggered,
		};
	};
}
