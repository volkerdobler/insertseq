import { describe, it, expect } from 'vitest';
import { formatString, formatNumber } from '../src/formatting';
import { createDecimalSeq } from '../src/sequences/decimal';
import { TParameter } from '../src/types';

import { getRegExpressions } from '../src/components/evaluator';

function createMockParameter(count = 5): TParameter {
	return {
		editor: {} as any,
		config: {
			get: (k: string) => (k === 'start' ? '1' : k === 'step' ? '1' : ''),
		} as any,
		cursors: count,
		multiCursorSort: 'default',
		selectionText: Array(count).fill(''),
		origTextSel: Array(count).fill(''),
		origCursorPos: Array(count).fill({} as any),
		segments: getRegExpressions(),
		formatSegments: {},
		myDelimiter: null,
	} as any;
}

describe('Arithmetic and Number Formatting', () => {
	describe('formatString (padding and alignment)', () => {
		it('supports left-alignment with # padding', () => {
			expect(formatString('42', '#<5')).toBe('42###');
		});

		it('supports right-alignment with space', () => {
			expect(formatString('42', '>5')).toBe('   42');
		});

		it('supports right-alignment with 0', () => {
			expect(formatString('42', '0>5')).toBe('00042');
		});

		it('supports center-alignment', () => {
			expect(formatString('x', '-=5')).toBe('--x--');
			expect(formatString('x', '-=6')).toBe('--x---'); // default left bias
			expect(formatString('x', '-=6l')).toBe('--x---'); // left bias
			expect(formatString('x', '-=6r')).toBe('---x--'); // right bias
			expect(formatString('xx', '-=6r')).toBe('--xx--'); // exact
		});

		it('does not pad when width is less than value length', () => {
			expect(formatString('abcdef', '3')).toBe('abcdef');
		});

		it('handles w flag (last character)', () => {
			expect(formatString('hello', '>10w')).toBe('         o');
			expect(formatString('hi', '#<5w')).toBe('i####');
		});
	});

	describe('formatNumber (d3-format)', () => {
		it('formats zero-padded decimal integers', () => {
			expect(formatNumber(5, '03d')).toBe('005');
			expect(formatNumber(42, '05d')).toBe('00042');
		});

		it('formats positive signed numbers', () => {
			expect(formatNumber(5, '+d')).toBe('+5');
			expect(formatNumber(-5, '+d')).toMatch(/^[−-]5$/);
		});

		it('formats hexadecimal numbers (lower and uppercase)', () => {
			expect(formatNumber(255, 'x')).toBe('ff');
			expect(formatNumber(255, 'X')).toBe('FF');
			expect(formatNumber(16, '#x')).toBe('0x10');
		});

		it('formats binary and octal numbers', () => {
			expect(formatNumber(5, 'b')).toBe('101');
			expect(formatNumber(8, 'o')).toBe('10');
		});

		it('formats floating point numbers', () => {
			expect(formatNumber(3.14159, '.2f')).toBe('3.14');
			expect(formatNumber(3.14159, '.4f')).toBe('3.1416');
		});
	});

	describe('createDecimalSeq (Sequences)', () => {
		it('generates standard incremental sequence', () => {
			const param = createMockParameter(5);
			const seqFn = createDecimalSeq('1:1', param, 10);
			const result = Array.from({ length: 5 }, (_, i) => seqFn(i).stringFunction);
			expect(result).toEqual(['1', '2', '3', '4', '5']);
		});

		it('generates negative step sequence', () => {
			const param = createMockParameter(4);
			const seqFn = createDecimalSeq('10:-2', param, 10);
			const result = Array.from({ length: 4 }, (_, i) => seqFn(i).stringFunction);
			expect(result).toEqual(['10', '8', '6', '4']);
		});

		it('generates floating point step sequence', () => {
			const param = createMockParameter(3);
			const seqFn = createDecimalSeq('0:0.5', param, 10);
			const result = Array.from({ length: 3 }, (_, i) => seqFn(i).stringFunction);
			expect(result).toEqual(['0', '0.5', '1']);
		});

		it('supports frequency (*)', () => {
			const param = createMockParameter(6);
			// *2 means each number repeated 2 times
			const seqFn = createDecimalSeq('1:1*2', param, 10);
			const result = Array.from({ length: 6 }, (_, i) => seqFn(i).stringFunction);
			expect(result).toEqual(['1', '1', '2', '2', '3', '3']);
		});

		it('supports repetition (#)', () => {
			const param = createMockParameter(6);
			// #3 means repeat cycle after 3 items
			const seqFn = createDecimalSeq('1:1#3', param, 10);
			const result = Array.from({ length: 6 }, (_, i) => seqFn(i).stringFunction);
			expect(result).toEqual(['1', '2', '3', '1', '2', '3']);
		});

		it('supports startover (##)', () => {
			const param = createMockParameter(6);
			// ##3 means cycle resets after 3 items
			const seqFn = createDecimalSeq('1:1##3', param, 10);
			const result = Array.from({ length: 6 }, (_, i) => seqFn(i).stringFunction);
			expect(result).toEqual(['1', '2', '3', '1', '2', '3']);
		});

		it('supports formatting (~)', () => {
			const param = createMockParameter(3);
			const seqFn = createDecimalSeq('1:1~03d', param, 10);
			const result = Array.from({ length: 3 }, (_, i) => seqFn(i).stringFunction);
			expect(result).toEqual(['001', '002', '003']);
		});
	});
});
