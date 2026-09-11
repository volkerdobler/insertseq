import { TParameter, TSpecialReplacementValues } from '../types';
import {
	printToConsole,
	runExpression,
	getFrequencyValue,
	getRepeatValue,
	getStartOverValue,
	getStopExpression,
	checkStopExpression,
	getExpression,
} from '../components/utils';

/**
 * Get random integer in range [0, max - 1] using cryptographically secure RNG.
 */
function getRandomInt(max: number): number {
	const bytes = new Uint32Array(1);
	globalThis.crypto.getRandomValues(bytes);
	return bytes[0] % max;
}

/**
 * Generate random string from a given charset.
 */
function getRandomChars(charset: string, len: number): string {
	const bytes = new Uint8Array(len);
	globalThis.crypto.getRandomValues(bytes);
	let res = '';
	const cLen = charset.length;
	for (let i = 0; i < len; i++) {
		res += charset[bytes[i] % cLen];
	}
	return res;
}

/**
 * Generate a cryptographically secure random password with guaranteed mixed character classes.
 */
function generatePassword(
	len: number,
	isUpper = false,
	isLower = false,
): string {
	const lower = 'abcdefghijklmnopqrstuvwxyz';
	const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const digits = '0123456789';
	const special = '!@#$%^&*_-+=~';

	const pools: string[] = [];
	if (!isUpper) {
		pools.push(lower);
	}
	if (!isLower) {
		pools.push(upper);
	}
	pools.push(digits);
	pools.push(special);

	const chars: string[] = [];
	// Guarantee at least one character from each active pool
	for (const pool of pools) {
		chars.push(pool[getRandomInt(pool.length)]);
	}

	const all = pools.join('');
	for (let i = chars.length; i < len; i++) {
		chars.push(all[getRandomInt(all.length)]);
	}

	// Fisher-Yates shuffle
	for (let i = chars.length - 1; i > 0; i--) {
		const j = getRandomInt(i + 1);
		const temp = chars[i];
		chars[i] = chars[j];
		chars[j] = temp;
	}

	return chars.join('');
}

/**
 * Build the sequence function for random tokens, passwords, and hash strings.
 *
 * Supported prefixes:
 * - \:rnd[:len]\ / nd:<len>\ - alphanumeric random string (default len: 16)
 * - \:hex[:len]\ / \hex:<len>\ - hexadecimal random string (default len: 32)
 * - \:pwd[:len]\ / \pwd:<len>\ - secure password with mixed chars & symbols (default len: 16)
 * - \:token[:len]\ / \	oken:<len>\ - URL-safe token (default len: 24)
 * - \:hash[:len]\ / \hash:<len>\ - hex hash string (default len: 32)
 *
 * Modifiers (via ~ or ?):
 * - \~u\ / \~upper\ - uppercase only
 * - \~l\ / \~lower\ - lowercase only
 * - \~d\ / \~digits\ - digits only (for PIN / OTP codes)
 * - \~a\ / \~alpha\ - letters only
 * - \~s\ / \~special\ - include special characters
 *
 * @param input - Raw user input string.
 * @param parameter - Shared command context.
 * @returns A per-index function \(i) => { stringFunction, stopFunction }\.
 */
export function createRandomTokenSeq(
	input: string,
	parameter: TParameter,
): (i: number) => { stringFunction: string; stopFunction: boolean } {
	const startMatch = input.match(parameter.segments['start_randomToken']);
	parameter.myDelimiter = startMatch?.groups?.seqdelimiter || null;

	const rawType = (startMatch?.groups?.tokenType || ':rnd')
		.toLowerCase()
		.replace(/:/g, '');

	const defaultLength =
		rawType === 'pwd' || rawType === 'password'
			? 16
			: rawType === 'hex' || rawType === 'hash'
				? 32
				: rawType === 'token'
					? 24
					: 16;

	const lenMatch = startMatch?.groups?.tokenLength;
	const length = lenMatch
		? Math.max(1, parseInt(lenMatch, 10))
		: defaultLength;

	const formatMatch = input.match(/[~?]([a-zA-Z0-9_-]+)/);
	const formatStr = (formatMatch ? formatMatch[1] : '').toLowerCase();
	const optStr = (startMatch?.groups?.tokenOptions || '').toLowerCase();
	const flags = formatStr + optStr;

	const isUpper = flags.includes('u');
	const isLower = flags.includes('l');
	const isDigits = flags.includes('d');
	const isAlpha = flags.includes('a');
	const isSpecial = flags.includes('s');

	const freq = getFrequencyValue(input, parameter);
	const repe = getRepeatValue(input, parameter);
	const startover = getStartOverValue(input, parameter);
	const stopexpr = getStopExpression(input, parameter);
	const expr = getExpression(input, parameter);

	function generateToken(): string {
		if (rawType === 'pwd' || rawType === 'password' || isSpecial) {
			return generatePassword(length, isUpper, isLower);
		}
		if (rawType === 'hex' || rawType === 'hash') {
			const hexCharset = isUpper
				? '0123456789ABCDEF'
				: '0123456789abcdef';
			return getRandomChars(hexCharset, length);
		}
		if (rawType === 'token') {
			return getRandomChars(
				'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
				length,
			);
		}
		// Default / rnd
		if (isDigits) {
			return getRandomChars('0123456789', length);
		}
		if (isAlpha) {
			if (isUpper) {
				return getRandomChars('ABCDEFGHIJKLMNOPQRSTUVWXYZ', length);
			}
			if (isLower) {
				return getRandomChars('abcdefghijklmnopqrstuvwxyz', length);
			}
			return getRandomChars(
				'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
				length,
			);
		}
		if (isUpper) {
			return getRandomChars(
				'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
				length,
			);
		}
		if (isLower) {
			return getRandomChars(
				'abcdefghijklmnopqrstuvwxyz0123456789',
				length,
			);
		}
		return getRandomChars(
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
			length,
		);
	}

	const generatedTokens: string[] = [];

	const replacableValues: TSpecialReplacementValues = {
		currentValueStr: '',
		valueAfterExpressionStr: '',
		previousValueStr: '',
		currentIndexStr: '',
		origTextStr: '',
		startStr: `${rawType}:${length}`,
		stepStr: '1',
		numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
	};

	return (i) => {
		const distinctIndex = Math.trunc(
			((i % startover) % (freq * repe)) / freq,
		);

		while (generatedTokens.length <= distinctIndex) {
			generatedTokens.push(generateToken());
		}

		let value = generatedTokens[distinctIndex];

		if (i < parameter.origTextSel.length) {
			replacableValues.origTextStr = parameter.origTextSel[i];
		} else {
			replacableValues.origTextStr = '';
		}
		replacableValues.currentIndexStr = i.toString();
		replacableValues.currentValueStr = value;
		replacableValues.valueAfterExpressionStr = '';

		if (expr.length > 0) {
			try {
				const toNumOrStr = (v: string): number | string => {
					const num = Number(v);
					return !isNaN(num) && v.trim() !== '' ? num : v;
				};
				const exprResult = runExpression(expr, {
					_: toNumOrStr(value),
					i,
					n: parameter.origCursorPos.length,
					s: 1,
					a: replacableValues.startStr,
					p: toNumOrStr(replacableValues.previousValueStr),
					o: replacableValues.origTextStr,
					c: replacableValues.valueAfterExpressionStr,
				});
				if (exprResult !== null && exprResult !== undefined) {
					value = String(exprResult);
				}
			} catch {
				printToConsole('Error evaluating expression for random token');
			}
		}

		replacableValues.valueAfterExpressionStr = value;

		let stopExpressionTriggered = i >= parameter.origCursorPos.length;
		if (stopexpr.length > 0) {
			stopExpressionTriggered = checkStopExpression(
				i,
				stopexpr,
				parameter.origCursorPos.length,
				replacableValues,
			);
		}

		replacableValues.previousValueStr = value;

		return {
			stringFunction: value,
			stopFunction: stopExpressionTriggered,
		};
	};
}
