import { describe, it, expect } from 'vitest';
import {
	getPresets,
	savePreset,
	deletePreset,
	clearPresets,
	resetToDefaultPresets,
	DEFAULT_PRESETS,
} from '../src/components/presets';
import {
	buildNumberSeq,
	buildAlphaSeq,
	buildDateSeq,
	buildDevOpsSeq,
	buildListSeq,
	buildExprSeq,
} from '../src/components/wizard';
import {
	validateSequenceInput,
	cleanErrorMessage,
} from '../src/components/validator';
import {
	formatPreviewText,
	buildOverflowPreview,
	getPreviewDecorationType,
	InsertSeqInlineCompletionProvider,
} from '../src/components/ghostText';
import { t, getLanguage } from '../src/i18n';
import { getRegExpressions } from '../src/components/evaluator';

describe('UX Components: Presets, Wizard, Validator, i18n & Preview', () => {
	describe('Preset Management', () => {
		const storage = new Map<string, any>();
		const mockCtx: any = {
			globalState: {
				get: (key: string) => storage.get(key),
				update: async (key: string, val: any) => {
					storage.set(key, val);
				},
			},
		};

		it('returns default presets when none are saved', () => {
			const initial = getPresets();
			expect(initial.length).toBe(DEFAULT_PRESETS.length);
		});

		it('saves and updates presets', async () => {
			await savePreset(mockCtx, {
				name: 'Custom Markdown Table',
				sequence: '1:1~<5',
				description: 'Table row numbering',
			});

			let list = getPresets(mockCtx);
			let found = list.find((p) => p.name === 'Custom Markdown Table');
			expect(found).toBeDefined();
			expect(found?.sequence).toBe('1:1~<5');

			// Update (case-insensitive)
			await savePreset(mockCtx, {
				name: 'custom markdown table',
				sequence: '1:2~<6',
			});
			list = getPresets(mockCtx);
			found = list.find((p) => p.name.toLowerCase() === 'custom markdown table');
			expect(found?.sequence).toBe('1:2~<6');
		});

		it('deletes a preset', async () => {
			await deletePreset(mockCtx, 'Custom Markdown Table');
			const list = getPresets(mockCtx);
			expect(list.find((p) => p.name === 'Custom Markdown Table')).toBeUndefined();
		});

		it('clears and resets presets to defaults', async () => {
			await clearPresets(mockCtx);
			expect(getPresets(mockCtx).length).toBe(0);

			await resetToDefaultPresets(mockCtx);
			expect(getPresets(mockCtx).length).toBe(DEFAULT_PRESETS.length);
		});
	});

	describe('Wizard Sequence Assembly', () => {
		it('assembles number sequence with steps, repeat and format', () => {
			expect(buildNumberSeq({ start: '1', step: '2', format: '~03d' })).toBe('1:2~03d');
			expect(
				buildNumberSeq({
					start: '0',
					step: '1',
					repeat: '5',
					frequency: '2',
					startover: '10',
				}),
			).toBe('0#5*2##10');
			expect(buildNumberSeq({ start: '1', format: '04d' })).toBe('1~04d');
		});

		it('assembles alpha sequence with casing options', () => {
			expect(buildAlphaSeq({ start: 'a', step: '1', caseStyle: 'upper' })).toBe('a?u');
			expect(
				buildAlphaSeq({
					start: 'B',
					step: '2',
					caseStyle: 'lower',
					format: '~<4',
				}),
			).toBe('B?l:2~<4');
		});

		it('assembles date sequence with intervals', () => {
			expect(buildDateSeq({ start: '%now', step: '1d', format: '~"yyyy-MM-dd"' })).toBe(
				'%now~"yyyy-MM-dd"',
			);
			expect(buildDateSeq({ start: '%2026-01-01', step: '1w', format: '~iso' })).toBe(
				'%2026-01-01:1w~iso',
			);
		});

		it('assembles devops, uuid, token and password sequences', () => {
			expect(buildDevOpsSeq({ type: 'uuid-v4' })).toBe(':uuid');
			expect(buildDevOpsSeq({ type: 'uuid-v7' })).toBe(':uuid:v7');
			expect(buildDevOpsSeq({ type: 'pwd', length: 24 })).toBe(':pwd:24');
			expect(buildDevOpsSeq({ type: 'hex', length: 16 })).toBe(':hex:16');
			expect(buildDevOpsSeq({ type: 'ip', ipStart: '10.0.0.1', ipStep: '2' })).toBe('10.0.0.1:2');
		});

		it('assembles list and expression sequences', () => {
			expect(buildListSeq(['apple', 'banana', 'cherry'])).toBe('["apple","banana","cherry"]');
			expect(buildExprSeq('"Item_" + (i+1)')).toBe('|"Item_" + (i+1)');
		});
	});

	describe('Validator and Live Syntax Feedback', () => {
		const rules = getRegExpressions();
		const paramDe: any = {
			segments: rules,
			origCursorPos: [{}, {}],
			origTextSel: ['', ''],
			config: {
				get: (k: string) => (k === 'language' ? 'de' : k === 'start' ? '1' : k === 'step' ? '1' : undefined),
			},
		};
		const paramEn: any = {
			segments: rules,
			origCursorPos: [{}, {}],
			origTextSel: ['', ''],
			config: {
				get: (k: string) => (k === 'language' ? 'en' : k === 'start' ? '1' : k === 'step' ? '1' : undefined),
			},
		};

		it('cleans JavaScript error messages', () => {
			expect(cleanErrorMessage('ReferenceError: myVar is not defined')).toBe("'myVar' is not defined");
		});

		it('returns null for valid inputs', () => {
			expect(validateSequenceInput('', paramDe)).toBeNull();
			expect(validateSequenceInput('1:1~03d', paramDe)).toBeNull();
			expect(validateSequenceInput('|i + 1', paramDe)).toBeNull();
			expect(validateSequenceInput('192.168.1.1:1', paramDe)).toBeNull();
		});

		it('detects syntax errors in standalone expressions', () => {
			const err = validateSequenceInput('|1 + (', paramDe);
			expect(err).not.toBeNull();
			expect(err?.severity).toBe(3); // Error
		});

		it('detects undefined variables in expressions', () => {
			const err = validateSequenceInput('|unknownVar + 1', paramDe);
			expect(err?.message).toContain("'unknownVar' is not defined");
		});

		it('provides operator syntax hints for trailing characters', () => {
			const stepHintDe = validateSequenceInput('1:', paramDe);
			expect(stepHintDe?.severity).toBe(1); // Info
			expect(stepHintDe?.message).toContain('Schrittweite');

			const stepHintEn = validateSequenceInput('1:', paramEn);
			expect(stepHintEn?.severity).toBe(1);
			expect(stepHintEn?.message).toContain('Step size');

			const freqHint = validateSequenceInput('1:2*', paramEn);
			expect(freqHint?.message).toContain('Frequency');

			const repHint = validateSequenceInput('1:2*3#', paramEn);
			expect(repHint?.message).toContain('Repeat');

			const startoverHint = validateSequenceInput('1:2##', paramEn);
			expect(startoverHint?.message).toContain('Restart');
		});

		it('detects semantic parameter errors', () => {
			const badFreq = validateSequenceInput('1*0', paramEn);
			expect(badFreq?.severity).toBe(3);
			expect(badFreq?.message).toContain('Invalid frequency');

			const badStep = validateSequenceInput('1:abc', paramEn);
			expect(badStep?.severity).toBe(3);
			expect(badStep?.message).toContain('Invalid step size');
		});
	});

	describe('Multilingual i18n Support', () => {
		it('resolves languages correctly', () => {
			expect(getLanguage({ config: { get: () => 'de' } } as any)).toBe('de');
			expect(getLanguage({ config: { get: () => 'en' } } as any)).toBe('en');
			expect(getLanguage({ config: { get: () => undefined } } as any)).toBe('en');
		});

		it('formats translated strings with placeholders', () => {
			const paramEn = { config: { get: () => 'en' } } as any;
			const msg = t('err_invalid_frequency', paramEn, '0');
			expect(msg).toBe('Invalid frequency "0": expected positive integer > 0 (e.g. *2)');
		});
	});

	describe('Ghost-Text Preview & Formatting', () => {
		it('formats tabs and newlines for preview display', () => {
			const tabFormatted = formatPreviewText('hello\tworld', 4);
			expect(tabFormatted).toContain('\u00A0\u00A0\u00A0\u00A0');

			const newlineFormatted = formatPreviewText('line1\nline2');
			expect(newlineFormatted).toContain('\u21b5\u00A0');
		});

		it('compacts long overflow lists into concise previews', () => {
			expect(buildOverflowPreview(['1', '2', '3'], ', ')).toBe('1, 2, 3');
			expect(
				buildOverflowPreview(['1', '2', '3', '4', '5', '6', '7', '8'], ', ', 5),
			).toBe('1, 2, 3, 4, 5 … (+3 more)');
		});

		it('configures decoration types based on previewMode', () => {
			const ghostDec = getPreviewDecorationType({
				get: (k: string) => (k === 'previewMode' ? 'ghostText' : undefined),
			} as any);
			expect((ghostDec as any).options?.after?.color?.id).toBe('editorGhostText.foreground');

			const classicDec = getPreviewDecorationType({
				get: (k: string) =>
					k === 'previewMode' ? 'decoration' : k === 'previewColor' ? '#ff0000' : undefined,
			} as any);
			expect((classicDec as any).options?.after?.color).toBe('#ff0000');
		});

		it('manages inline completion items in InsertSeqInlineCompletionProvider', () => {
			const provider = new InsertSeqInlineCompletionProvider();
			let notified = false;
			provider.onDidChangeInlineCompletions(() => {
				notified = true;
			});

			provider.update([{ insertText: 'preview-item' } as any]);
			expect(notified).toBe(true);

			const items = provider.provideInlineCompletionItems({} as any, {} as any, {} as any, {} as any);
			expect((items as any)?.items?.length).toBe(1);

			provider.clear();
			const cleared = provider.provideInlineCompletionItems({} as any, {} as any, {} as any, {} as any);
			expect(cleared).toBeUndefined();

			provider.dispose();
		});
	});
});
