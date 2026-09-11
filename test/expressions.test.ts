import { describe, it, expect } from 'vitest';
import { runExpression, checkStopExpression } from '../src/components/utils';
import { TParameter } from '../src/types';

function createExprMockParameter(): TParameter {
	return {
		editor: {} as any,
		config: {
			get: () => '',
		} as any,
		cursors: 5,
		multiCursorSort: 'default',
		selectionText: ['foo', 'bar', 'baz'],
		origTextSel: ['foo', 'bar', 'baz'],
	} as any;
}

describe('JS Expressions and Stop-Conditions', () => {
	describe('runExpression with typed scope variables', () => {
		it('evaluates arithmetic with numeric _ correctly without string concatenation', () => {
			const res = runExpression('_ + 1', { _: 1, i: 0, n: 1 });
			expect(res).toBe(2);
		});

		it('performs numeric comparison properly', () => {
			const resTrue = runExpression('_ > 5', { _: 10, i: 0, n: 10 });
			const resFalse = runExpression('_ > 5', { _: 3, i: 0, n: 3 });
			expect(resTrue).toBe(true);
			expect(resFalse).toBe(false);
		});

		it('evaluates index i correctly', () => {
			const res = runExpression('i * 10', { _: 0, i: 3, n: 0 });
			expect(res).toBe(30);
		});

		it('supports string manipulation when _ is a string', () => {
			const res = runExpression('_.toUpperCase() + "!"', { _: 'hello', i: 0 });
			expect(res).toBe('HELLO!');
		});

		it('supports custom scope variables (s, a, p, o, c)', () => {
			const res = runExpression('_ + s', { _: 10, s: 5, i: 0 });
			expect(res).toBe(15);
		});
	});

	describe('checkStopExpression', () => {
		const makeReplacable = (current: string, prev = ''): any => ({
			currentValueStr: current,
			valueAfterExpressionStr: '',
			previousValueStr: prev,
			currentIndexStr: '0',
			origTextStr: '',
			startStr: '1',
			stepStr: '1',
			numberOfSelectionsStr: '5',
		});

		it('returns false when stop condition is not met (_ > 10)', () => {
			const stop = checkStopExpression(0, '_ > 10', 5, makeReplacable('5'));
			expect(stop).toBe(false);
		});

		it('returns true when stop condition is met (_ > 10)', () => {
			const stop = checkStopExpression(1, '_ > 10', 5, makeReplacable('11'));
			expect(stop).toBe(true);
		});

		it('evaluates stop condition based on index (i >= 3)', () => {
			expect(checkStopExpression(2, 'i >= 3', 5, makeReplacable('1'))).toBe(false);
			expect(checkStopExpression(3, 'i >= 3', 5, makeReplacable('1'))).toBe(true);
		});

		it('handles equality stop condition (_ == "exit")', () => {
			expect(checkStopExpression(0, '_ == "exit"', 5, makeReplacable('run'))).toBe(false);
			expect(checkStopExpression(1, '_ == "exit"', 5, makeReplacable('exit'))).toBe(true);
		});
	});
});
