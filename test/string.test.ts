import { describe, it, expect } from 'vitest';
import { createStringSeq } from '../src/sequences/string';
import { getRegExpressions } from '../src/components/evaluator';
import { TParameter } from '../src/types';

function createStringMockParameter(options: {
	alphabet?: string;
	alphaCapital?: string;
	count?: number;
} = {}): TParameter {
	const count = options.count ?? 5;
	const store: Record<string, any> = {
		alphabet: options.alphabet ?? 'abcdefghijklmnopqrstuvwxyz',
		alphaCapital: options.alphaCapital ?? 'preserve',
		stringFormat: '',
		reverse: false,
		step: '1',
		frequency: '1',
		repetition: '',
		startover: '',
	};

	return {
		editor: {} as any,
		config: {
			get: (key: string) => store[key] ?? '',
		} as any,
		cursors: count,
		multiCursorSort: 'default',
		selectionText: Array(count).fill(''),
		origTextSel: Array(count).fill(''),
		origCursorPos: Array(count).fill({} as any),
		segments: getRegExpressions(),
		formatSegments: {},
	} as any;
}

describe('String and Alphabet Sequences', () => {
	it('generates standard lowercase alphabetic sequence', () => {
		const param = createStringMockParameter({ count: 5 });
		const seqFn = createStringSeq('a:1', param);
		const result = Array.from({ length: 5 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['a', 'b', 'c', 'd', 'e']);
	});

	it('generates uppercase alphabetic sequence', () => {
		const param = createStringMockParameter({ count: 4 });
		const seqFn = createStringSeq('A:1', param);
		const result = Array.from({ length: 4 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['A', 'B', 'C', 'D']);
	});

	it('handles character overflow from z to aa', () => {
		const param = createStringMockParameter({ count: 4 });
		const seqFn = createStringSeq('y:1', param);
		const result = Array.from({ length: 4 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['y', 'z', 'aa', 'ab']);
	});

	it('handles multi-char overflow from az to ba', () => {
		const param = createStringMockParameter({ count: 3 });
		const seqFn = createStringSeq('az:1', param);
		const result = Array.from({ length: 3 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['az', 'ba', 'bb']);
	});

	it('supports step increments greater than 1', () => {
		const param = createStringMockParameter({ count: 4 });
		const seqFn = createStringSeq('a:2', param);
		const result = Array.from({ length: 4 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['a', 'c', 'e', 'g']);
	});

	it('supports frequency (*)', () => {
		const param = createStringMockParameter({ count: 4 });
		const seqFn = createStringSeq('a:1*2', param);
		const result = Array.from({ length: 4 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['a', 'a', 'b', 'b']);
	});

	it('supports repetition (#)', () => {
		const param = createStringMockParameter({ count: 4 });
		const seqFn = createStringSeq('a:1#2', param);
		const result = Array.from({ length: 4 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['a', 'b', 'a', 'b']);
	});

	it('supports cycle startover (##)', () => {
		const param = createStringMockParameter({ count: 6 });
		const seqFn = createStringSeq('a:1##3', param);
		const result = Array.from({ length: 6 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
	});

	it('respects uppercase forced config', () => {
		const param = createStringMockParameter({ alphaCapital: 'upper', count: 3 });
		const seqFn = createStringSeq('a:1', param);
		const result = Array.from({ length: 3 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['A', 'B', 'C']);
	});

	it('respects lowercase forced config', () => {
		const param = createStringMockParameter({ alphaCapital: 'lower', count: 3 });
		const seqFn = createStringSeq('A:1', param);
		const result = Array.from({ length: 3 }, (_, i) => seqFn(i).stringFunction);
		expect(result).toEqual(['a', 'b', 'c']);
	});
});
