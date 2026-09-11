import { describe, it, expect } from 'vitest';
import { formatTemporalDateTime } from '../src/formatting';
import { Temporal } from 'temporal-polyfill';
import { getRegExpressions } from '../src/components/evaluator';
import { RuleTemplate } from '../src/types';

describe('Date & Time Formatting and Evaluator Parsing', () => {
	const dt = Temporal.PlainDateTime.from({
		year: 2026,
		month: 3,
		day: 15,
		hour: 9,
		minute: 5,
		second: 3,
	});

	describe('formatTemporalDateTime', () => {
		it('formats ISO year, month, day with padding', () => {
			expect(formatTemporalDateTime(dt, 'yyyy-MM-dd')).toBe('2026-03-15');
			expect(formatTemporalDateTime(dt, 'yyyy/MM/dd')).toBe('2026/03/15');
		});

		it('formats custom date tokens (dd.MM.yyyy)', () => {
			expect(formatTemporalDateTime(dt, 'dd.MM.yyyy')).toBe('15.03.2026');
		});

		it('formats time components (HH, mm, ss)', () => {
			expect(formatTemporalDateTime(dt, 'HH:mm:ss')).toBe('09:05:03');
			expect(formatTemporalDateTime(dt, 'HH:mm')).toBe('09:05');
		});

		it('formats combined date and time', () => {
			expect(formatTemporalDateTime(dt, 'yyyy-MM-dd HH:mm:ss')).toBe('2026-03-15 09:05:03');
		});

		it('supports ~iso shortcut format', () => {
			expect(formatTemporalDateTime(dt, 'iso')).toBe('2026-03-15T09:05:03');
		});

		it('supports ~epoch and ~epochms timestamps', () => {
			const epochSec = formatTemporalDateTime(dt, 'epoch');
			const epochMs = formatTemporalDateTime(dt, 'epochms');
			expect(epochSec).toMatch(/^\d{10}$/);
			expect(epochMs).toMatch(/^\d{13}$/);
			expect(epochMs.startsWith(epochSec)).toBe(true);
		});
	});

	describe('Date-Time Evaluator Parsing', () => {
		const rules = getRegExpressions();

		it('matches time start with start_date regex', () => {
			const m1 = '%14:00'.match(new RegExp(rules.start_date, 'i'));
			expect(m1?.groups?.start).toBe('14:00');

			const m3 = '%3:03 :15min'.match(new RegExp(rules.start_date, 'i'));
			expect(m3?.groups?.start).toBe('3:03');
		});

		it('matches date step with minute interval (:15min)', () => {
			const match = '%2026-03-31:15min'.match(new RegExp(rules.steps_date, 'i'));
			expect(match).not.toBeNull();
			expect(match?.groups?.step_expr).toBe('15min');
		});

		it('matches date step with combined interval (:1d15min)', () => {
			const match = '%14:00:1d15min'.match(new RegExp(rules.steps_date, 'i'));
			expect(match).not.toBeNull();
			expect(match?.groups?.step_expr).toBe('1d15min');
		});

		it('matches date step with negative hour interval (:-2h)', () => {
			const match = '%2026-03-31:-2h'.match(new RegExp(rules.steps_date, 'i'));
			expect(match).not.toBeNull();
			expect(match?.groups?.step_expr).toBe('-2h');
		});

		it('matches date step with day interval (:1d)', () => {
			const match = '%2026-03-31:1d'.match(new RegExp(rules.steps_date, 'i'));
			expect(match).not.toBeNull();
			expect(match?.groups?.step_expr).toBe('1d');
		});

		it('matches date step with month interval (:1M)', () => {
			const match = '%2026-03-31:1M'.match(new RegExp(rules.steps_date, 'i'));
			expect(match).not.toBeNull();
			expect(match?.groups?.step_expr).toBe('1M');
		});

		it('matches date step with year interval (:1y)', () => {
			const match = '%2026-03-31:1y'.match(new RegExp(rules.steps_date, 'i'));
			expect(match).not.toBeNull();
			expect(match?.groups?.step_expr).toBe('1y');
		});
	});
});
