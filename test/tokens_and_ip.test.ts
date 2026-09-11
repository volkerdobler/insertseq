import { describe, it, expect } from 'vitest';
import {
	toRoman,
	formatNumber,
	ipToNumber,
	numberToIp,
	numberToBinaryIp,
	numberToHexIp,
} from '../src/formatting';
import { createIpSeq } from '../src/sequences/ip';
import { createUuidSeq } from '../src/sequences/uuid';
import { createRandomTokenSeq } from '../src/sequences/randomToken';
import { getRegExpressions } from '../src/components/evaluator';
import { TParameter } from '../src/types';

function createMockParam(store: Record<string, any> = {}): TParameter {
	const count = 5;
	return {
		editor: {} as any,
		cursors: count,
		multiCursorSort: 'default',
		origCursorPos: Array(count).fill({} as any),
		selectionText: Array(count).fill(''),
		origTextSel: Array(count).fill(''),
		segments: getRegExpressions(),
		formatSegments: {},
		config: {
			get: (key: string) => store[key] ?? '',
		} as any,
		myDelimiter: null,
	} as any;
}

describe('Tokens, Roman Numerals & IPv4 Sequences', () => {
	describe('Roman Numerals', () => {
		it('converts numbers to standard Roman numerals', () => {
			expect(toRoman(1)).toBe('I');
			expect(toRoman(4)).toBe('IV');
			expect(toRoman(9)).toBe('IX');
			expect(toRoman(14)).toBe('XIV');
			expect(toRoman(40)).toBe('XL');
			expect(toRoman(90)).toBe('XC');
			expect(toRoman(1999)).toBe('MCMXCIX');
			expect(toRoman(2026)).toBe('MMXXVI');
		});

		it('supports lowercase Roman numerals', () => {
			expect(toRoman(14, true)).toBe('xiv');
			expect(toRoman(4, true)).toBe('iv');
		});

		it('formats via formatNumber (~R, ~r, ~roman)', () => {
			expect(formatNumber(14, 'R')).toBe('XIV');
			expect(formatNumber(14, 'r')).toBe('xiv');
			expect(formatNumber(14, 'roman')).toBe('XIV');
			expect(formatNumber(4, '>5R')).toBe('   IV');
		});
	});

	describe('IPv4 Address Sequences & Conversions', () => {
		it('converts between IPv4 strings and 32-bit integers', () => {
			const ip = '192.168.1.1';
			const num = 3232235777;
			expect(ipToNumber(ip)).toBe(num);
			expect(numberToIp(num)).toBe(ip);
		});

		it('supports padded, hex and binary IP formats', () => {
			const num = 3232235777;
			expect(numberToIp(num, true)).toBe('192.168.001.001');
			expect(numberToHexIp(num)).toBe('c0a80101');
			expect(numberToHexIp(num, true)).toBe('C0A80101');
			expect(numberToBinaryIp(num)).toBe('11000000.10101000.00000001.00000001');
		});

		it('increments IP addresses across host and subnet boundaries', () => {
			const param = createMockParam();
			const hostSeq = createIpSeq('192.168.1.1:1', param);
			expect(hostSeq(0).stringFunction).toBe('192.168.1.1');
			expect(hostSeq(1).stringFunction).toBe('192.168.1.2');

			const rolloverSeq = createIpSeq('192.168.1.255:1', param);
			expect(rolloverSeq(0).stringFunction).toBe('192.168.1.255');
			expect(rolloverSeq(1).stringFunction).toBe('192.168.2.0');
		});

		it('preserves CIDR notation in sequences', () => {
			const param = createMockParam();
			const cidrSeq = createIpSeq('10.0.0.1/24:1', param);
			expect(cidrSeq(0).stringFunction).toBe('10.0.0.1/24');
			expect(cidrSeq(1).stringFunction).toBe('10.0.0.2/24');
		});
	});

	describe('UUID Sequences (v4 & v7)', () => {
		it('generates valid UUIDv4 strings', () => {
			const param = createMockParam();
			const uuidFn = createUuidSeq(':uuid', param);
			const id1 = uuidFn(0).stringFunction;
			const id2 = uuidFn(1).stringFunction;

			expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
			expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
			expect(id1).not.toBe(id2);
		});

		it('generates valid UUIDv7 strings (:uuid:v7)', () => {
			const param = createMockParam();
			const uuidFn = createUuidSeq(':uuid:v7', param);
			const id = uuidFn(0).stringFunction;
			expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		});
	});

	describe('Random Tokens & Passwords', () => {
		it('generates random hex strings (:hex:16)', () => {
			const param = createMockParam();
			const hexFn = createRandomTokenSeq(':hex:16', param);
			const token = hexFn(0).stringFunction;
			expect(token).toMatch(/^[0-9a-f]{16}$/);
		});

		it('generates secure passwords with mixed characters (:pwd:12)', () => {
			const param = createMockParam();
			const pwdFn = createRandomTokenSeq(':pwd:12', param);
			const pwd = pwdFn(0).stringFunction;
			expect(pwd.length).toBe(12);
		});
	});
});

