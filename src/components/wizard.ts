import * as vscode from 'vscode';
import { TParameter } from '../types';

/**
 * Pure builders for assembling syntax strings.
 * Exposed for unit testing without VS Code UI dependencies.
 */
export interface INumberSeqOptions {
	start: string;
	step?: string;
	format?: string;
	repeat?: string;
	frequency?: string;
	startover?: string;
}

export function buildNumberSeq(opts: INumberSeqOptions): string {
	const start = opts.start.trim() || '1';
	let res = start;
	if (opts.step && opts.step.trim() !== '1' && opts.step.trim() !== '') {
		res += ':' + opts.step.trim();
	}
	if (opts.repeat && opts.repeat.trim() !== '') {
		res += '#' + opts.repeat.trim();
	}
	if (opts.frequency && opts.frequency.trim() !== '' && opts.frequency.trim() !== '1') {
		res += '*' + opts.frequency.trim();
	}
	if (opts.startover && opts.startover.trim() !== '') {
		res += '##' + opts.startover.trim();
	}
	if (opts.format && opts.format.trim() !== '') {
		const fmt = opts.format.trim();
		res += fmt.startsWith('~') ? fmt : '~' + fmt;
	}
	return res;
}

export interface IAlphaSeqOptions {
	start: string;
	step?: string;
	caseStyle?: 'preserve' | 'lower' | 'upper' | 'pascal' | '';
	format?: string;
}

export function buildAlphaSeq(opts: IAlphaSeqOptions): string {
	const start = opts.start.trim() || 'a';
	let res = start;
	if (opts.caseStyle === 'lower') {
		res += '?l';
	} else if (opts.caseStyle === 'upper') {
		res += '?u';
	} else if (opts.caseStyle === 'pascal') {
		res += '?p';
	}
	if (opts.step && opts.step.trim() !== '1' && opts.step.trim() !== '') {
		res += ':' + opts.step.trim();
	}
	if (opts.format && opts.format.trim() !== '') {
		const fmt = opts.format.trim();
		res += fmt.startsWith('~') ? fmt : '~' + fmt;
	}
	return res;
}

export interface IDateSeqOptions {
	start: string;
	step?: string;
	format?: string;
}

export function buildDateSeq(opts: IDateSeqOptions): string {
	const start = opts.start.trim() || '%now';
	let res = start;
	if (opts.step && opts.step.trim() !== '' && opts.step.trim() !== '1d') {
		res += ':' + opts.step.trim();
	}
	if (opts.format && opts.format.trim() !== '') {
		const fmt = opts.format.trim();
		res += fmt.startsWith('~') ? fmt : '~' + fmt;
	}
	return res;
}

export interface IDevOpsSeqOptions {
	type: 'uuid-v4' | 'uuid-v7' | 'pwd' | 'rnd' | 'hex' | 'pin' | 'ip';
	length?: number | string;
	ipStart?: string;
	ipStep?: string;
}

export function buildDevOpsSeq(opts: IDevOpsSeqOptions): string {
	switch (opts.type) {
		case 'uuid-v4':
			return ':uuid';
		case 'uuid-v7':
			return ':uuid:v7';
		case 'pwd':
			return `:pwd:${opts.length || 16}`;
		case 'rnd':
			return `:rnd:${opts.length || 16}`;
		case 'hex':
			return `:hex:${opts.length || 32}`;
		case 'pin':
			return `:rnd:${opts.length || 6}~d`;
		case 'ip': {
			const start = opts.ipStart?.trim() || '192.168.1.1';
			const step = opts.ipStep?.trim() || '1';
			return `${start}:${step}`;
		}
	}
}

export function buildListSeq(items: string[]): string {
	const cleaned = items.map((s) => s.trim()).filter(Boolean);
	return JSON.stringify(cleaned);
}

export function buildExprSeq(expr: string): string {
	const trimmed = expr.trim();
	return trimmed.startsWith('|') ? trimmed : '|' + trimmed;
}

// ---------------------------------------------------------------------------
// Wizard UI helpers
// ---------------------------------------------------------------------------

interface IQuickPickStepOptions<T extends vscode.QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	placeholder: string;
	items: T[];
	canGoBack?: boolean;
	onDidSelect?: (item: T) => void;
}

function pickStep<T extends vscode.QuickPickItem>(
	options: IQuickPickStepOptions<T>,
): Promise<T | 'back' | undefined> {
	return new Promise((resolve) => {
		const qp = vscode.window.createQuickPick<T>();
		qp.title = options.title;
		qp.step = options.step;
		qp.totalSteps = options.totalSteps;
		qp.placeholder = options.placeholder;
		qp.items = options.items;
		qp.buttons = options.canGoBack ? [vscode.QuickInputButtons.Back] : [];
		qp.matchOnDescription = true;
		qp.matchOnDetail = true;

		let resolved = false;

		qp.onDidChangeActive((active) => {
			if (active[0] && options.onDidSelect) {
				options.onDidSelect(active[0]);
			}
		});

		qp.onDidTriggerButton((btn) => {
			if (btn === vscode.QuickInputButtons.Back) {
				resolved = true;
				qp.hide();
				resolve('back');
			}
		});

		qp.onDidAccept(() => {
			const selected = qp.activeItems[0];
			resolved = true;
			qp.hide();
			resolve(selected);
		});

		qp.onDidHide(() => {
			qp.dispose();
			if (!resolved) {
				resolve(undefined);
			}
		});

		qp.show();
	});
}

interface IInputStepOptions {
	title: string;
	step: number;
	totalSteps: number;
	prompt: string;
	value: string;
	canGoBack?: boolean;
	validate?: (value: string) => string | null;
	onChange?: (value: string) => void;
}

function inputStep(
	options: IInputStepOptions,
): Promise<string | 'back' | undefined> {
	return new Promise((resolve) => {
		const ib = vscode.window.createInputBox();
		ib.title = options.title;
		ib.step = options.step;
		ib.totalSteps = options.totalSteps;
		ib.prompt = options.prompt;
		ib.value = options.value;
		ib.buttons = options.canGoBack ? [vscode.QuickInputButtons.Back] : [];

		let resolved = false;

		ib.onDidChangeValue((val) => {
			if (options.validate) {
				const err = options.validate(val);
				ib.validationMessage = err ?? undefined;
			}
			if (options.onChange) {
				options.onChange(val);
			}
		});

		ib.onDidTriggerButton((btn) => {
			if (btn === vscode.QuickInputButtons.Back) {
				resolved = true;
				ib.hide();
				resolve('back');
			}
		});

		ib.onDidAccept(() => {
			const val = ib.value;
			if (options.validate) {
				const err = options.validate(val);
				if (err) {
					ib.validationMessage = err;
					return;
				}
			}
			resolved = true;
			ib.hide();
			resolve(val);
		});

		ib.onDidHide(() => {
			ib.dispose();
			if (!resolved) {
				resolve(undefined);
			}
		});

		ib.show();
	});
}

export interface IWizardCallbacks {
	preview: (seq: string) => void;
	clearPreview: () => void;
	commit: (seq: string) => Promise<void>;
	editInInputBox: (seq: string) => Promise<void>;
	savePreset: (seq: string) => Promise<void>;
	cancel: () => void;
}

/**
 * Main wizard execution controller.
 * Guides the user through steps, building a sequence string with live preview,
 * then executing or saving the result.
 *
 * @param parameter - Extension runtime parameter context.
 * @param callbacks - Event callbacks to handle preview, insertion, editing, and cancellation.
 */
export async function startSequenceWizard(
	_parameter: TParameter,
	callbacks: IWizardCallbacks,
): Promise<void> {
	type StepFn = () => Promise<'next' | 'back' | 'cancel'>;
	const historyStack: StepFn[] = [];

	// Helper to update preview
	function updatePreview(seq: string) {
		callbacks.preview(seq);
	}

	// -----------------------------------------------------------------------
	// Branch: Numbers
	// -----------------------------------------------------------------------
	function pushNumbersFlow() {
		const numOpts: INumberSeqOptions = {
			start: '1',
			step: '1',
			format: '',
		};

		// Step 2: Start value
		const stepStart: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: Numbers — Start Value',
				step: 2,
				totalSteps: 5,
				placeholder: 'Select a start number or type custom',
				canGoBack: true,
				items: [
					{ label: '1', description: 'Start at 1 (1, 2, 3...)' },
					{ label: '0', description: 'Start at 0 (0, 1, 2...)' },
					{ label: '100', description: 'Start at 100' },
					{ label: '0x0', description: 'Hexadecimal starting at 0' },
					{ label: '0b0', description: 'Binary starting at 0' },
					{ label: '$(edit) Custom start...', description: 'Enter any number or radix' },
				],
				onDidSelect: (item) => {
					if (!item.label.startsWith('$(')) {
						numOpts.start = item.label;
						updatePreview(buildNumberSeq(numOpts));
					}
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			if (choice.label.startsWith('$(')) {
				const custom = await inputStep({
					title: 'Wizard: Numbers — Custom Start Value',
					step: 2,
					totalSteps: 5,
					prompt: 'Enter start value (e.g. 10, -5, 0.5, 0x10, 1r10 for random)',
					value: numOpts.start,
					canGoBack: true,
					validate: (v) => (v.trim() ? null : 'Start value cannot be empty'),
					onChange: (v) => {
						numOpts.start = v;
						updatePreview(buildNumberSeq(numOpts));
					},
				});
				if (!custom) {
					return 'cancel';
				}
				if (custom === 'back') {
					return 'back';
				}
				numOpts.start = custom.trim();
			} else {
				numOpts.start = choice.label;
			}

			updatePreview(buildNumberSeq(numOpts));
			historyStack.push(stepStep);
			return 'next';
		};

		// Step 3: Step / Increment
		const stepStep: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: Numbers — Increment / Step',
				step: 3,
				totalSteps: 5,
				placeholder: 'Select increment per cursor',
				canGoBack: true,
				items: [
					{ label: '1', description: 'Increment by +1 (1, 2, 3...)' },
					{ label: '2', description: 'Increment by +2 (1, 3, 5...)' },
					{ label: '5', description: 'Increment by +5 (0, 5, 10...)' },
					{ label: '10', description: 'Increment by +10' },
					{ label: '-1', description: 'Decrement by -1 (10, 9, 8...)' },
					{ label: '$(edit) Custom step...', description: 'Enter custom step' },
				],
				onDidSelect: (item) => {
					if (!item.label.startsWith('$(')) {
						numOpts.step = item.label;
						updatePreview(buildNumberSeq(numOpts));
					}
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			if (choice.label.startsWith('$(')) {
				const custom = await inputStep({
					title: 'Wizard: Numbers — Custom Increment',
					step: 3,
					totalSteps: 5,
					prompt: 'Enter step (e.g. 3, -2, 0.5)',
					value: numOpts.step || '1',
					canGoBack: true,
					validate: (v) => (v.trim() ? null : 'Step cannot be empty'),
					onChange: (v) => {
						numOpts.step = v;
						updatePreview(buildNumberSeq(numOpts));
					},
				});
				if (!custom) {
					return 'cancel';
				}
				if (custom === 'back') {
					return 'back';
				}
				numOpts.step = custom.trim();
			} else {
				numOpts.step = choice.label;
			}

			updatePreview(buildNumberSeq(numOpts));
			historyStack.push(stepFormat);
			return 'next';
		};

		// Step 4: Formatting / Padding
		const stepFormat: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: Numbers — Output Format & Padding',
				step: 4,
				totalSteps: 5,
				placeholder: 'Select a number format or padding style',
				canGoBack: true,
				items: [
					{ label: 'None', description: 'Standard unformatted numbers (1, 2, 10...)' },
					{ label: '~02d', description: 'Zero-padded 2 digits (01, 02, 10...)' },
					{ label: '~03d', description: 'Zero-padded 3 digits (001, 002, 010...)' },
					{ label: '~04d', description: 'Zero-padded 4 digits (0001, 0002...)' },
					{ label: '~<4', description: 'Left-aligned, space padded width 4 ("1   ", "2   ")' },
					{ label: '~>4', description: 'Right-aligned, space padded width 4 ("   1", "   2")' },
					{ label: '~R', description: 'Roman numerals uppercase (I, II, III, IV...)' },
					{ label: '~r', description: 'Roman numerals lowercase (i, ii, iii, iv...)' },
					{ label: '$(edit) Custom format...', description: 'Custom d3 or string format' },
				],
				onDidSelect: (item) => {
					if (!item.label.startsWith('$(')) {
						numOpts.format = item.label === 'None' ? '' : item.label;
						updatePreview(buildNumberSeq(numOpts));
					}
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			if (choice.label.startsWith('$(')) {
				const custom = await inputStep({
					title: 'Wizard: Numbers — Custom Format',
					step: 4,
					totalSteps: 5,
					prompt: 'Enter format (e.g. ~05d, ~>8, ~$, ~%)',
					value: numOpts.format || '',
					canGoBack: true,
					onChange: (v) => {
						numOpts.format = v;
						updatePreview(buildNumberSeq(numOpts));
					},
				});
				if (!custom) {
					return 'cancel';
				}
				if (custom === 'back') {
					return 'back';
				}
				numOpts.format = custom.trim();
			} else {
				numOpts.format = choice.label === 'None' ? '' : choice.label;
			}

			updatePreview(buildNumberSeq(numOpts));
			historyStack.push(() => pushSummaryFlow(buildNumberSeq(numOpts), 5));
			return 'next';
		};

		historyStack.push(stepStart);
	}

	// -----------------------------------------------------------------------
	// Branch: Letters / Alphabet
	// -----------------------------------------------------------------------
	function pushAlphaFlow() {
		const alphaOpts: IAlphaSeqOptions = {
			start: 'a',
			step: '1',
			caseStyle: 'preserve',
		};

		const stepStart: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: Letters — Start Letter',
				step: 2,
				totalSteps: 4,
				placeholder: 'Select start letter',
				canGoBack: true,
				items: [
					{ label: 'a', description: 'Lowercase a (a, b, c...)' },
					{ label: 'A', description: 'Uppercase A (A, B, C...)' },
					{ label: 'z', description: 'Lowercase z' },
					{ label: '$(edit) Custom start letter...', description: 'Enter any single letter' },
				],
				onDidSelect: (item) => {
					if (!item.label.startsWith('$(')) {
						alphaOpts.start = item.label;
						updatePreview(buildAlphaSeq(alphaOpts));
					}
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			if (choice.label.startsWith('$(')) {
				const custom = await inputStep({
					title: 'Wizard: Letters — Custom Start',
					step: 2,
					totalSteps: 4,
					prompt: 'Enter start letter (e.g. a, A, k)',
					value: alphaOpts.start,
					canGoBack: true,
					validate: (v) => (v.trim() ? null : 'Letter cannot be empty'),
					onChange: (v) => {
						alphaOpts.start = v;
						updatePreview(buildAlphaSeq(alphaOpts));
					},
				});
				if (!custom) {
					return 'cancel';
				}
				if (custom === 'back') {
					return 'back';
				}
				alphaOpts.start = custom.trim();
			} else {
				alphaOpts.start = choice.label;
			}

			updatePreview(buildAlphaSeq(alphaOpts));
			historyStack.push(stepCase);
			return 'next';
		};

		const stepCase: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: Letters — Case Handling',
				step: 3,
				totalSteps: 4,
				placeholder: 'Select letter casing',
				canGoBack: true,
				items: [
					{ label: 'Preserve', description: 'Keep case of start letter' },
					{ label: 'Lowercase (?l)', description: 'Force all letters lowercase' },
					{ label: 'Uppercase (?u)', description: 'Force all letters UPPERCASE' },
					{ label: 'Pascal (?p)', description: 'PascalCase (Ab, Ac...)' },
				],
				onDidSelect: (item) => {
					if (item.label.startsWith('Lowercase')) {
						alphaOpts.caseStyle = 'lower';
					} else if (item.label.startsWith('Uppercase')) {
						alphaOpts.caseStyle = 'upper';
					} else if (item.label.startsWith('Pascal')) {
						alphaOpts.caseStyle = 'pascal';
					} else {
						alphaOpts.caseStyle = 'preserve';
					}
					updatePreview(buildAlphaSeq(alphaOpts));
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			if (choice.label.startsWith('Lowercase')) {
				alphaOpts.caseStyle = 'lower';
			} else if (choice.label.startsWith('Uppercase')) {
				alphaOpts.caseStyle = 'upper';
			} else if (choice.label.startsWith('Pascal')) {
				alphaOpts.caseStyle = 'pascal';
			} else {
				alphaOpts.caseStyle = 'preserve';
			}

			updatePreview(buildAlphaSeq(alphaOpts));
			historyStack.push(() => pushSummaryFlow(buildAlphaSeq(alphaOpts), 4));
			return 'next';
		};

		historyStack.push(stepStart);
	}

	// -----------------------------------------------------------------------
	// Branch: Date & Time
	// -----------------------------------------------------------------------
	function pushDateFlow() {
		const dateOpts: IDateSeqOptions = {
			start: '%now',
			step: '1d',
			format: '',
		};

		const stepStart: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: Date & Time — Starting Point',
				step: 2,
				totalSteps: 4,
				placeholder: 'Select starting date or time',
				canGoBack: true,
				items: [
					{ label: '%now', description: 'Current date and time right now' },
					{ label: '%date:', description: "Today's calendar date" },
					{ label: '%09:00', description: 'Time starting at 09:00' },
					{ label: '%12:00', description: 'Time starting at 12:00' },
					{ label: '$(edit) Custom date/time...', description: 'Enter specific date or time' },
				],
				onDidSelect: (item) => {
					if (!item.label.startsWith('$(')) {
						dateOpts.start = item.label;
						updatePreview(buildDateSeq(dateOpts));
					}
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			if (choice.label.startsWith('$(')) {
				const custom = await inputStep({
					title: 'Wizard: Date & Time — Custom Start',
					step: 2,
					totalSteps: 4,
					prompt: 'Enter date/time (e.g. %2026-01-01, %14:30)',
					value: dateOpts.start,
					canGoBack: true,
					validate: (v) => (v.trim() ? null : 'Date cannot be empty'),
					onChange: (v) => {
						dateOpts.start = v.startsWith('%') ? v : '%' + v;
						updatePreview(buildDateSeq(dateOpts));
					},
				});
				if (!custom) {
					return 'cancel';
				}
				if (custom === 'back') {
					return 'back';
				}
				dateOpts.start = custom.startsWith('%') ? custom : '%' + custom;
			} else {
				dateOpts.start = choice.label;
			}

			updatePreview(buildDateSeq(dateOpts));
			historyStack.push(stepStep);
			return 'next';
		};

		const stepStep: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: Date & Time — Step Duration',
				step: 3,
				totalSteps: 4,
				placeholder: 'Select step interval between items',
				canGoBack: true,
				items: [
					{ label: '1d', description: 'Daily (+1 day per cursor)' },
					{ label: '1w', description: 'Weekly (+1 week / 7 days)' },
					{ label: '1m', description: 'Monthly (+1 month)' },
					{ label: '1y', description: 'Yearly (+1 year)' },
					{ label: '1h', description: 'Hourly (+1 hour)' },
					{ label: '15min', description: '15 Minutes interval' },
					{ label: '30s', description: '30 Seconds interval' },
					{ label: '$(edit) Custom duration...', description: 'Enter compound step (e.g. 2h30min, 3d)' },
				],
				onDidSelect: (item) => {
					if (!item.label.startsWith('$(')) {
						dateOpts.step = item.label;
						updatePreview(buildDateSeq(dateOpts));
					}
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			if (choice.label.startsWith('$(')) {
				const custom = await inputStep({
					title: 'Wizard: Date & Time — Custom Step',
					step: 3,
					totalSteps: 4,
					prompt: 'Enter step duration (e.g. 2d, 1h30min, 10s)',
					value: dateOpts.step || '1d',
					canGoBack: true,
					validate: (v) => (v.trim() ? null : 'Step cannot be empty'),
					onChange: (v) => {
						dateOpts.step = v;
						updatePreview(buildDateSeq(dateOpts));
					},
				});
				if (!custom) {
					return 'cancel';
				}
				if (custom === 'back') {
					return 'back';
				}
				dateOpts.step = custom.trim();
			} else {
				dateOpts.step = choice.label;
			}

			updatePreview(buildDateSeq(dateOpts));
			historyStack.push(stepFormat);
			return 'next';
		};

		const stepFormat: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: Date & Time — Formatting',
				step: 4,
				totalSteps: 5,
				placeholder: 'Select output format',
				canGoBack: true,
				items: [
					{ label: 'Default', description: 'ISO Date or Time depending on start' },
					{ label: '~"yyyy-MM-dd"', description: 'ISO date: 2026-03-09' },
					{ label: '~"dd.MM.yyyy"', description: 'German / European date: 09.03.2026' },
					{ label: '~"yyyy-MM-dd HH:mm:ss"', description: 'Full timestamp: 2026-03-09 14:30:00' },
					{ label: '~"HH:mm"', description: '24h time only: 14:30' },
					{ label: '~iso', description: 'Strict ISO 8601 string' },
					{ label: '~utc', description: 'UTC timestamp (with Z)' },
					{ label: '~epoch', description: 'Unix timestamp in seconds' },
					{ label: '~epochms', description: 'Unix timestamp in milliseconds' },
					{ label: '$(edit) Custom format...', description: 'Custom date format tokens' },
				],
				onDidSelect: (item) => {
					if (!item.label.startsWith('$(')) {
						dateOpts.format = item.label === 'Default' ? '' : item.label;
						updatePreview(buildDateSeq(dateOpts));
					}
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			if (choice.label.startsWith('$(')) {
				const custom = await inputStep({
					title: 'Wizard: Date & Time — Custom Format',
					step: 4,
					totalSteps: 5,
					prompt: 'Enter token string (e.g. ~"yyyy/MM/dd", ~"MMMM yyyy")',
					value: dateOpts.format || '',
					canGoBack: true,
					onChange: (v) => {
						dateOpts.format = v;
						updatePreview(buildDateSeq(dateOpts));
					},
				});
				if (!custom) {
					return 'cancel';
				}
				if (custom === 'back') {
					return 'back';
				}
				dateOpts.format = custom.trim();
			} else {
				dateOpts.format = choice.label === 'Default' ? '' : choice.label;
			}

			updatePreview(buildDateSeq(dateOpts));
			historyStack.push(() => pushSummaryFlow(buildDateSeq(dateOpts), 5));
			return 'next';
		};

		historyStack.push(stepStart);
	}

	// -----------------------------------------------------------------------
	// Branch: DevOps / Utilities
	// -----------------------------------------------------------------------
	function pushDevOpsFlow() {
		const devOpts: IDevOpsSeqOptions = {
			type: 'uuid-v4',
		};

		const stepChoose: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: DevOps & Utilities — Generator Type',
				step: 2,
				totalSteps: 3,
				placeholder: 'Select utility generator',
				canGoBack: true,
				items: [
					{ label: 'UUID v4', description: 'Random standard UUID v4 (:uuid)' },
					{ label: 'UUID v7', description: 'Time-sortable UUID v7 (:uuid:v7)' },
					{ label: 'Password (16 chars)', description: 'Strong mixed password (:pwd:16)' },
					{ label: 'Password (24 chars)', description: 'Strong mixed password (:pwd:24)' },
					{ label: 'Random Alphanumeric (16 chars)', description: 'Random token (:rnd:16)' },
					{ label: 'Hex Hash (32 chars)', description: 'Cryptographic hex hash (:hex:32)' },
					{ label: 'PIN Code (6 digits)', description: 'Numeric PIN (:rnd:6~d)' },
					{ label: 'IPv4 Subnet (192.168.1.1:1)', description: 'Consecutive IP addresses' },
				],
				onDidSelect: (item) => {
					if (item.label.startsWith('UUID v4')) {
						devOpts.type = 'uuid-v4';
					} else if (item.label.startsWith('UUID v7')) {
						devOpts.type = 'uuid-v7';
					} else if (item.label.startsWith('Password (16')) {
						devOpts.type = 'pwd';
						devOpts.length = 16;
					} else if (item.label.startsWith('Password (24')) {
						devOpts.type = 'pwd';
						devOpts.length = 24;
					} else if (item.label.startsWith('Random Alphanumeric')) {
						devOpts.type = 'rnd';
						devOpts.length = 16;
					} else if (item.label.startsWith('Hex Hash')) {
						devOpts.type = 'hex';
						devOpts.length = 32;
					} else if (item.label.startsWith('PIN Code')) {
						devOpts.type = 'pin';
						devOpts.length = 6;
					} else if (item.label.startsWith('IPv4')) {
						devOpts.type = 'ip';
					}
					updatePreview(buildDevOpsSeq(devOpts));
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			if (choice.label.startsWith('UUID v4')) {
				devOpts.type = 'uuid-v4';
			} else if (choice.label.startsWith('UUID v7')) {
				devOpts.type = 'uuid-v7';
			} else if (choice.label.startsWith('Password (16')) {
				devOpts.type = 'pwd';
				devOpts.length = 16;
			} else if (choice.label.startsWith('Password (24')) {
				devOpts.type = 'pwd';
				devOpts.length = 24;
			} else if (choice.label.startsWith('Random Alphanumeric')) {
				devOpts.type = 'rnd';
				devOpts.length = 16;
			} else if (choice.label.startsWith('Hex Hash')) {
				devOpts.type = 'hex';
				devOpts.length = 32;
			} else if (choice.label.startsWith('PIN Code')) {
				devOpts.type = 'pin';
				devOpts.length = 6;
			} else if (choice.label.startsWith('IPv4')) {
				devOpts.type = 'ip';
			}

			updatePreview(buildDevOpsSeq(devOpts));
			historyStack.push(() => pushSummaryFlow(buildDevOpsSeq(devOpts), 3));
			return 'next';
		};

		historyStack.push(stepChoose);
	}

	// -----------------------------------------------------------------------
	// Branch: Custom List / Words
	// -----------------------------------------------------------------------
	function pushListFlow() {
		const stepInput: StepFn = async () => {
			const input = await inputStep({
				title: 'Wizard: Custom List — Enter Items',
				step: 2,
				totalSteps: 3,
				prompt: 'Enter comma-separated items (e.g. apple, banana, cherry, date)',
				value: 'alpha, beta, gamma, delta',
				canGoBack: true,
				validate: (v) => (v.trim() ? null : 'Items cannot be empty'),
				onChange: (v) => {
					const items = v.split(',');
					updatePreview(buildListSeq(items));
				},
			});

			if (!input) {
				return 'cancel';
			}
			if (input === 'back') {
				return 'back';
			}

			const seq = buildListSeq(input.split(','));
			updatePreview(seq);
			historyStack.push(() => pushSummaryFlow(seq, 3));
			return 'next';
		};

		historyStack.push(stepInput);
	}

	// -----------------------------------------------------------------------
	// Branch: JavaScript Expression
	// -----------------------------------------------------------------------
	function pushExprFlow() {
		const stepInput: StepFn = async () => {
			const choice = await pickStep({
				title: 'Wizard: JavaScript Expression — Formula',
				step: 2,
				totalSteps: 3,
				placeholder: 'Select a template or write custom JS formula',
				canGoBack: true,
				items: [
					{ label: '|"Item_" + (i + 1)', description: 'Item_1, Item_2, Item_3...' },
					{ label: '|i * 10', description: '0, 10, 20, 30...' },
					{ label: '|Math.pow(2, i)', description: 'Powers of 2: 1, 2, 4, 8, 16...' },
					{ label: '$(edit) Custom formula...', description: 'Write custom JavaScript expression' },
				],
				onDidSelect: (item) => {
					if (!item.label.startsWith('$(')) {
						updatePreview(buildExprSeq(item.label));
					}
				},
			});

			if (!choice) {
				return 'cancel';
			}
			if (choice === 'back') {
				return 'back';
			}

			let seq = '';
			if (choice.label.startsWith('$(')) {
				const custom = await inputStep({
					title: 'Wizard: Custom JavaScript Expression',
					step: 2,
					totalSteps: 3,
					prompt: 'Enter JS formula with variable i (index) or _ (value)',
					value: '|"Row_" + (i + 1)',
					canGoBack: true,
					validate: (v) => (v.trim() ? null : 'Expression cannot be empty'),
					onChange: (v) => updatePreview(buildExprSeq(v)),
				});
				if (!custom) {
					return 'cancel';
				}
				if (custom === 'back') {
					return 'back';
				}
				seq = buildExprSeq(custom);
			} else {
				seq = buildExprSeq(choice.label);
			}

			updatePreview(seq);
			historyStack.push(() => pushSummaryFlow(seq, 3));
			return 'next';
		};

		historyStack.push(stepInput);
	}

	// -----------------------------------------------------------------------
	// Final Step: Summary & Actions
	// -----------------------------------------------------------------------
	async function pushSummaryFlow(
		finalSeq: string,
		stepNumber: number,
	): Promise<'next' | 'back' | 'cancel'> {
		updatePreview(finalSeq);

		const action = await pickStep({
			title: `Wizard: Ready to Insert Sequence "${finalSeq}"`,
			step: stepNumber,
			totalSteps: stepNumber,
			placeholder: `Sequence: ${finalSeq} — Choose action`,
			canGoBack: true,
			items: [
				{
					label: '$(check) Insert Sequence',
					description: `Insert "${finalSeq}" at all cursors`,
					detail: 'Commits the sequence to your document and saves it to history',
				},
				{
					label: '$(edit) Fine-tune in Input Box',
					description: 'Open standard sequence input box pre-filled with this sequence',
					detail: 'Allows adding advanced modifiers (delimiters, stop conditions, etc.)',
				},
				{
					label: '$(star) Save as Preset',
					description: `Save "${finalSeq}" to your favorites`,
					detail: 'Stores permanently with a custom friendly name',
				},
				{
					label: '$(close) Cancel',
					description: 'Cancel and discard changes',
				},
			],
		});

		if (!action || action === 'back') {
			return action === 'back' ? 'back' : 'cancel';
		}

		if (action.label.includes('Insert Sequence')) {
			await callbacks.commit(finalSeq);
			return 'next';
		}
		if (action.label.includes('Fine-tune')) {
			await callbacks.editInInputBox(finalSeq);
			return 'next';
		}
		if (action.label.includes('Save as Preset')) {
			await callbacks.savePreset(finalSeq);
			return 'next';
		}

		callbacks.cancel();
		return 'cancel';
	}

	// -----------------------------------------------------------------------
	// Step 1: Choose Sequence Type
	// -----------------------------------------------------------------------
	const stepType: StepFn = async () => {
		const choice = await pickStep({
			title: 'Wizard: Select Sequence Type',
			step: 1,
			totalSteps: 4,
			placeholder: 'Choose the kind of sequence you want to create',
			canGoBack: false,
			items: [
				{
					label: '$(symbol-number) Numbers & Integers',
					description: 'Standard numbers, decimals, padding, roman numerals (1, 2, 3...)',
				},
				{
					label: '$(symbol-string) Letters & Alphabet',
					description: 'Alphabetical characters, lowercase, uppercase (a, b, c...)',
				},
				{
					label: '$(calendar) Date & Time',
					description: 'Dates, timestamps, intervals, custom formatting (2026-03-09...)',
				},
				{
					label: '$(tools) DevOps, UUIDs & Passwords',
					description: 'UUID v4/v7, secure passwords, random tokens, IPv4 subnets',
				},
				{
					label: '$(list-unordered) Custom List / Words',
					description: 'Arbitrary list of words or items (["foo", "bar", "baz"])',
				},
				{
					label: '$(code) JavaScript Expression',
					description: 'Formula or dynamic script logic (|"item_" + (i+1))',
				},
			],
		});

		if (!choice || choice === 'back') {
			return 'cancel';
		}

		if (choice.label.includes('Numbers')) {
			pushNumbersFlow();
		} else if (choice.label.includes('Letters')) {
			pushAlphaFlow();
		} else if (choice.label.includes('Date')) {
			pushDateFlow();
		} else if (choice.label.includes('DevOps')) {
			pushDevOpsFlow();
		} else if (choice.label.includes('Custom List')) {
			pushListFlow();
		} else if (choice.label.includes('JavaScript Expression')) {
			pushExprFlow();
		}

		return 'next';
	};

	historyStack.push(stepType);

	// Execution loop
	while (historyStack.length > 0) {
		const currentStep = historyStack[historyStack.length - 1];
		const res = await currentStep();
		if (res === 'cancel') {
			callbacks.cancel();
			return;
		}
		if (res === 'back') {
			historyStack.pop();
			if (historyStack.length === 0) {
				callbacks.cancel();
				return;
			}
		}
		// if 'next' and nothing added to historyStack, wizard completed!
		if (res === 'next' && currentStep === historyStack[historyStack.length - 1]) {
			break;
		}
	}
}
