// Mock vscode for standalone Node test runner
declare const require: any;
declare const process: any;
const Module = require('module');
const origRequire = Module.prototype.require;
const mockConfigStore: Record<string, any> = {};
Module.prototype.require = function (id: string) {
	if (id === 'vscode') {
		return {
			ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
			InputBoxValidationSeverity: {
				Info: 1,
				Warning: 2,
				Error: 3,
			},
			ThemeColor: function (id: string) {
				(this as any).id = id;
			},
			EventEmitter: class {
				private listeners: Function[] = [];
				get event() {
					return (listener: Function) => {
						this.listeners.push(listener);
						return { dispose: () => {} };
					};
				}
				fire(data?: any) {
					for (const l of this.listeners) {
						l(data);
					}
				}
				dispose() {
					this.listeners = [];
				}
			},
			InlineCompletionList: function (items: any[]) {
				(this as any).items = items;
			},
			InlineCompletionItem: function (text: string, range?: any) {
				(this as any).insertText = text;
				(this as any).range = range;
			},
			WorkspaceEdit: class {
				private edits: Array<{ type: string; uri: any; rangeOrPos: any; text: string }> = [];
				replace(uri: any, range: any, text: string) {
					this.edits.push({ type: 'replace', uri, rangeOrPos: range, text });
				}
				insert(uri: any, position: any, text: string) {
					this.edits.push({ type: 'insert', uri, rangeOrPos: position, text });
				}
				delete(uri: any, range: any) {
					this.edits.push({ type: 'delete', uri, rangeOrPos: range, text: '' });
				}
				has(uri: any) {
					return this.edits.some((e) => e.uri === uri);
				}
				entries() {
					return [[undefined, this.edits]];
				}
			},
			workspace: {
				getConfiguration: () => ({
					get: (key: string) => mockConfigStore[key],
					update: async (key: string, value: any) => {
						mockConfigStore[key] = value;
					},
				}),
				applyEdit: async (_edit: any) => true,
			},
			window: {
				createOutputChannel: () => ({
					appendLine: () => {},
					dispose: () => {},
				}),
				createTextEditorDecorationType: (options: any) => ({
					key: 'mock-dec',
					dispose: () => {},
					options,
				}),
			},
		};
	}
	return origRequire.apply(this, arguments);
};

import {
	formatString,
	formatTemporalDateTime,
	formatNumber,
	toRoman,
	ipToNumber,
	numberToIp,
	numberToBinaryIp,
	numberToHexIp,
} from './formatting';
import { Temporal } from 'temporal-polyfill';
import { getRegExpressions } from './components/evaluator';
import { RuleTemplate, TParameter } from './types';

const { createIpSeq } = require('./sequences/ip');
const { createDecimalSeq } = require('./sequences/decimal');
import { runExpression, checkStopExpression } from './components/utils';
import { t, getLanguage } from './i18n';
import {
	formatPreviewText,
	buildOverflowPreview,
	getPreviewDecorationType,
	InsertSeqInlineCompletionProvider,
} from './components/ghostText';

function assertEqual(a: any, b: any, msg?: string) {
	if (a !== b) {
		throw new Error(`Assertion failed: ${a} !== ${b}. ${msg || ''}`);
	}
}

// Basic padding right (default right-align)
assertEqual(formatString('42', '#<5'), '42###', 'left-align with #'); // left-align with '#'
assertEqual(formatString('42', '>5'), '   42', 'right-align with space'); // right-align with spaces
assertEqual(formatString('42', '0>5'), '00042', 'right-align with 0'); // right-align with '0'

// center
assertEqual(formatString('x', '-=5'), '--x--', 'center 5 width');
assertEqual(
	formatString('x', '-=6'),
	'--x---',
	'center 6 width - default left bias',
);
assertEqual(formatString('x', '-=6l'), '--x---', 'center 6 width - left bias');
assertEqual(formatString('x', '-=6r'), '---x--', 'center 6 width - right bias');
assertEqual(formatString('xx', '-=6r'), '--xx--', 'center 6 width - exactly');

// width less than value -> no padding
assertEqual(
	formatString('abcdef', '3'),
	'abcdef',
	'no padding when width < value length',
);

// w flag -> last char
assertEqual(
	formatString('hello', '>10w'),
	'         o',
	'last char with w flag - hello',
);
assertEqual(formatString('hi', '#<5w'), 'i####', 'last char with w flag - hi');

console.log('formatting tests passed');

// Date & Time formatting tests
const dt = Temporal.PlainDateTime.from('2026-03-09T14:30:15');
assertEqual(
	formatTemporalDateTime(dt, 'yyyy-MM-dd HH:mm:ss'),
	'2026-03-09 14:30:15',
	'full datetime token test',
);
assertEqual(
	formatTemporalDateTime(dt, 'iso'),
	'2026-03-09T14:30:15',
	'iso format test',
);
assertEqual(
	formatTemporalDateTime(dt, 'utc'),
	'2026-03-09T14:30:15Z',
	'utc format test',
);
assertEqual(
	formatTemporalDateTime(dt, 'epoch'),
	'1773066615',
	'epoch timestamp test',
);

console.log('date-time formatting tests passed');

// Evaluator date parsing test
const rules = getRegExpressions();
const m1 = '%14:00'.match(new RegExp(rules.start_date, 'i'));
assertEqual(m1?.groups?.start, '14:00', '14:00 start time extracted');

const m3 = '%3:03 :15min'.match(new RegExp(rules.start_date, 'i'));
assertEqual(m3?.groups?.start, '3:03', '3:03 extracted from %3:03 :15min');

const s3 = '%14:00:1d15min'.match(new RegExp(rules.steps_date, 'i'));
assertEqual(s3?.groups?.step_expr, '1d15min', '1d15min step_expr extracted');

console.log('date-time evaluator parsing tests passed');

// Random token regex parsing tests
const rnd1 = ':rnd:12'.match(new RegExp(rules.start_randomToken, 'i'));
assertEqual(rnd1?.groups?.tokenType, ':rnd', ':rnd tokenType matched');
assertEqual(rnd1?.groups?.tokenLength, '12', '12 length matched');

const rnd2 = 'rnd:16'.match(new RegExp(rules.start_randomToken, 'i'));
assertEqual(rnd2?.groups?.tokenType, 'rnd:', 'rnd: tokenType matched');
assertEqual(rnd2?.groups?.tokenLength, '16', '16 length matched');

const hex1 = ':hex:32'.match(new RegExp(rules.start_randomToken, 'i'));
assertEqual(hex1?.groups?.tokenType, ':hex', ':hex tokenType matched');
assertEqual(hex1?.groups?.tokenLength, '32', '32 length matched');

const pwd1 = ':pwd:20'.match(new RegExp(rules.start_randomToken, 'i'));
assertEqual(pwd1?.groups?.tokenType, ':pwd', ':pwd tokenType matched');
assertEqual(pwd1?.groups?.tokenLength, '20', '20 length matched');

// Collision safety tests!
// 1. Decimal random numbers (e.g. 1r5) MUST match start_decimal and NOT start_randomToken
const decRnd = '1r5'.match(new RegExp(rules.start_decimal, 'i'));
assertEqual(decRnd?.groups?.start, '1', '1r5 start is 1');
assertEqual(decRnd?.groups?.rndNumber, '5', '1r5 rndNumber is 5');
const decRndNoToken = '1r5'.match(new RegExp(rules.start_randomToken, 'i'));
assertEqual(decRndNoToken, null, '1r5 does not match start_randomToken');

// 2. Plain words "rnd" and "hex" without colon MUST match start_alpha and NOT start_randomToken
const plainRndNoToken = 'rnd'.match(new RegExp(rules.start_randomToken, 'i'));
assertEqual(
	plainRndNoToken,
	null,
	'plain rnd does not match start_randomToken',
);

const plainHexNoToken = 'hex'.match(new RegExp(rules.start_randomToken, 'i'));
assertEqual(
	plainHexNoToken,
	null,
	'plain hex does not match start_randomToken',
);

// 3. Hex numbers (0x1A) must NOT match start_randomToken
const hexNumNoToken = '0x1A'.match(new RegExp(rules.start_randomToken, 'i'));
assertEqual(hexNumNoToken, null, '0x1A does not match start_randomToken');

console.log('random token tests passed');

// Roman numeral formatting tests
assertEqual(toRoman(1), 'I', '1 is I');
assertEqual(toRoman(4), 'IV', '4 is IV');
assertEqual(toRoman(9), 'IX', '9 is IX');
assertEqual(toRoman(14), 'XIV', '14 is XIV');
assertEqual(toRoman(40), 'XL', '40 is XL');
assertEqual(toRoman(90), 'XC', '90 is XC');
assertEqual(toRoman(1999), 'MCMXCIX', '1999 is MCMXCIX');
assertEqual(toRoman(2026), 'MMXXVI', '2026 is MMXXVI');
assertEqual(toRoman(14, true), 'xiv', '14 is xiv in lowercase');
assertEqual(toRoman(4, true), 'iv', '4 is iv in lowercase');

assertEqual(formatNumber(14, 'R'), 'XIV', 'formatNumber 14 R');
assertEqual(formatNumber(14, 'r'), 'xiv', 'formatNumber 14 r');
assertEqual(formatNumber(14, 'roman'), 'XIV', 'formatNumber 14 roman');
assertEqual(formatNumber(4, '>5R'), '   IV', 'formatNumber 4 >5R with padding');

const formatRomanMatch = '1~R'.match(new RegExp(rules.format_decimal, 'i'));
assertEqual(
	formatRomanMatch?.groups?.type,
	'R',
	'1~R matches format_decimal type R',
);

const formatRomanLowerMatch = '1~r'.match(
	new RegExp(rules.format_decimal, 'i'),
);
assertEqual(
	formatRomanLowerMatch?.groups?.type,
	'r',
	'1~r matches format_decimal type r',
);

console.log('roman numeral tests passed');

// IPv4 conversion tests
assertEqual(ipToNumber('192.168.1.1'), 3232235777, 'ipToNumber 192.168.1.1');
assertEqual(numberToIp(3232235777), '192.168.1.1', 'numberToIp 3232235777');
assertEqual(
	numberToIp(3232235777, true),
	'192.168.001.001',
	'numberToIp padded',
);
assertEqual(numberToHexIp(3232235777), 'c0a80101', 'numberToHexIp lower');
assertEqual(numberToHexIp(3232235777, true), 'C0A80101', 'numberToHexIp upper');
assertEqual(
	numberToBinaryIp(3232235777),
	'11000000.10101000.00000001.00000001',
	'numberToBinaryIp',
);

// IPv4 regex matching tests
const ip1 = '192.168.1.1:1'.match(new RegExp(rules.start_ip, 'i'));
assertEqual(ip1?.groups?.ipAddress, '192.168.1.1', 'ip1 ipAddress');
assertEqual(ip1?.groups?.cidr, undefined, 'ip1 cidr is undefined');

const ipCidr = '10.0.0.1/24:1'.match(new RegExp(rules.start_ip, 'i'));
assertEqual(ipCidr?.groups?.ipAddress, '10.0.0.1', 'ipCidr ipAddress');
assertEqual(ipCidr?.groups?.cidr, '/24', 'ipCidr cidr /24');

const ipPrefixTest = ':ip:1'.match(new RegExp(rules.start_ip, 'i'));
assertEqual(ipPrefixTest?.groups?.ipPrefix, ':ip', ':ip:1 ipPrefix');

const ipPrefixWithIp = ':ip:10.0.0.1'.match(new RegExp(rules.start_ip, 'i'));
assertEqual(ipPrefixWithIp?.groups?.ipPrefix, ':ip:', ':ip:10.0.0.1 ipPrefix');
assertEqual(
	ipPrefixWithIp?.groups?.ipAddress,
	'10.0.0.1',
	':ip:10.0.0.1 ipAddress',
);

// Collision safety:
// Decimals (3.14, 192.168), words (rnd, ip without colon), and hex (0x1A) MUST NOT match charStartIp
assertEqual(
	new RegExp(rules.charStartIp, 'i').test('3.14'),
	false,
	'3.14 does not match charStartIp',
);
assertEqual(
	new RegExp(rules.charStartIp, 'i').test('192.168'),
	false,
	'192.168 does not match charStartIp',
);
assertEqual(
	new RegExp(rules.charStartIp, 'i').test('0x1A'),
	false,
	'0x1A does not match charStartIp',
);
assertEqual(
	new RegExp(rules.charStartIp, 'i').test('rnd'),
	false,
	'rnd does not match charStartIp',
);
assertEqual(
	new RegExp(rules.charStartIp, 'i').test('ip'),
	false,
	'plain word "ip" does not match charStartIp',
);
assertEqual(
	new RegExp(rules.charStartIp, 'i').test(':ip'),
	true,
	':ip matches charStartIp',
);
assertEqual(
	new RegExp(rules.charStartIp, 'i').test('192.168.1.1'),
	true,
	'192.168.1.1 matches charStartIp',
);

// createIpSeq sequence evaluation tests
function createMockParam(r: RuleTemplate): TParameter {
	return {
		editor: {} as any,
		origCursorPos: [{} as any, {} as any, {} as any, {} as any, {} as any],
		origTextSel: ['', '', '', '', ''],
		segments: r,
		config: {
			get: (key: string) => {
				if (key === 'frequency') {
					return 1;
				}
				if (key === 'repetition') {
					return Number.MAX_SAFE_INTEGER;
				}
				if (key === 'startover') {
					return Number.MAX_SAFE_INTEGER;
				}
				return undefined;
			},
		} as any,
		myDelimiter: null,
	};
}

const mockParam = createMockParam(rules);

// Host increment
const hostSeq = createIpSeq('192.168.1.1:1', mockParam);
assertEqual(hostSeq(0).stringFunction, '192.168.1.1', 'hostSeq 0');
assertEqual(hostSeq(1).stringFunction, '192.168.1.2', 'hostSeq 1');
assertEqual(hostSeq(2).stringFunction, '192.168.1.3', 'hostSeq 2');

// Rollover across subnet boundary
const rolloverSeq = createIpSeq('192.168.1.255:1', mockParam);
assertEqual(rolloverSeq(0).stringFunction, '192.168.1.255', 'rolloverSeq 0');
assertEqual(rolloverSeq(1).stringFunction, '192.168.2.0', 'rolloverSeq 1');
assertEqual(rolloverSeq(2).stringFunction, '192.168.2.1', 'rolloverSeq 2');

// Negative step across boundary
const negStepSeq = createIpSeq('10.0.1.0:-1', mockParam);
assertEqual(negStepSeq(0).stringFunction, '10.0.1.0', 'negStepSeq 0');
assertEqual(negStepSeq(1).stringFunction, '10.0.0.255', 'negStepSeq 1');

// CIDR retention
const cidrSeq = createIpSeq('10.0.0.1/24:1', mockParam);
assertEqual(cidrSeq(0).stringFunction, '10.0.0.1/24', 'cidrSeq 0');
assertEqual(cidrSeq(1).stringFunction, '10.0.0.2/24', 'cidrSeq 1');

// Zero padding format ~0
const padSeq = createIpSeq('192.168.1.1:1~0', mockParam);
assertEqual(padSeq(0).stringFunction, '192.168.001.001', 'padSeq 0');
assertEqual(padSeq(1).stringFunction, '192.168.001.002', 'padSeq 1');

// Hex format ~hex / ~HEX
const hexSeq = createIpSeq('192.168.1.1:1~hex', mockParam);
assertEqual(hexSeq(0).stringFunction, 'c0a80101', 'hexSeq 0');
assertEqual(hexSeq(1).stringFunction, 'c0a80102', 'hexSeq 1');
const hexUpperSeq = createIpSeq('192.168.1.1:1~HEX', mockParam);
assertEqual(hexUpperSeq(0).stringFunction, 'C0A80101', 'hexUpperSeq 0');

// Binary format ~bin
const binSeq = createIpSeq('192.168.1.1:1~bin', mockParam);
assertEqual(
	binSeq(0).stringFunction,
	'11000000.10101000.00000001.00000001',
	'binSeq 0',
);

// Int format ~int
const intSeq = createIpSeq('192.168.1.1:1~int', mockParam);
assertEqual(intSeq(0).stringFunction, '3232235777', 'intSeq 0');
assertEqual(intSeq(1).stringFunction, '3232235778', 'intSeq 1');

// Default start with :ip:1
const defaultIpSeq = createIpSeq(':ip:1', mockParam);
assertEqual(defaultIpSeq(0).stringFunction, '192.168.1.1', 'defaultIpSeq 0');
assertEqual(defaultIpSeq(1).stringFunction, '192.168.1.2', 'defaultIpSeq 1');

// Custom ipStart setting
const customParam = createMockParam(rules);
(customParam.config as any).get = (key: string) => {
	if (key === 'frequency') {
		return 1;
	}
	if (key === 'repetition') {
		return Number.MAX_SAFE_INTEGER;
	}
	if (key === 'startover') {
		return Number.MAX_SAFE_INTEGER;
	}
	if (key === 'ipStart') {
		return '10.10.0.1';
	}
	return undefined;
};
const customIpSeq = createIpSeq(':ip:1', customParam);
assertEqual(customIpSeq(0).stringFunction, '10.10.0.1', 'customIpSeq 0');
assertEqual(customIpSeq(1).stringFunction, '10.10.0.2', 'customIpSeq 1');

// Custom ipStart with CIDR
(customParam.config as any).get = (key: string) => {
	if (key === 'ipStart') {
		return '172.16.0.1/16';
	}
	return undefined;
};
const customCidrSeq = createIpSeq(':ip:1', customParam);
assertEqual(
	customCidrSeq(0).stringFunction,
	'172.16.0.1/16',
	'customCidrSeq 0',
);
assertEqual(
	customCidrSeq(1).stringFunction,
	'172.16.0.2/16',
	'customCidrSeq 1',
);

console.log('IPv4 sequence tests passed');

// Presets tests
const {
	getPresets,
	savePreset,
	deletePreset,
	clearPresets,
	resetToDefaultPresets,
	DEFAULT_PRESETS,
} = require('./components/presets');

// 1. Initial presets fallback to defaults
const initialPresets = getPresets();
assertEqual(
	initialPresets.length,
	DEFAULT_PRESETS.length,
	'initial presets length equals default presets length',
);

// 2. Mock context with globalState
const testGlobalState: Record<string, any> = {};
const mockExtensionContext: any = {
	globalState: {
		get: (key: string) => testGlobalState[key],
		update: async (key: string, val: any) => {
			testGlobalState[key] = val;
		},
	},
};

(async () => {
	// Save new preset
	await savePreset(mockExtensionContext, {
		name: 'Custom Markdown Table',
		sequence: '1:1~<5',
		description: 'Table row numbering',
	});

	let current = getPresets(mockExtensionContext);
	const found = current.find((p: any) => p.name === 'Custom Markdown Table');
	assertEqual(!!found, true, 'custom preset was saved');
	assertEqual(found.sequence, '1:1~<5', 'custom preset sequence is correct');

	// Update existing preset (case-insensitive name match)
	await savePreset(mockExtensionContext, {
		name: 'custom markdown table',
		sequence: '1:2~<6',
		description: 'Updated description',
	});

	current = getPresets(mockExtensionContext);
	const updated = current.find(
		(p: any) => p.name.toLowerCase() === 'custom markdown table',
	);
	assertEqual(updated.sequence, '1:2~<6', 'preset was updated');

	// Delete preset
	await deletePreset(mockExtensionContext, 'Custom Markdown Table');
	current = getPresets(mockExtensionContext);
	const deleted = current.find(
		(p: any) => p.name.toLowerCase() === 'custom markdown table',
	);
	assertEqual(deleted, undefined, 'preset was deleted');

	// Clear all presets
	await clearPresets(mockExtensionContext);
	current = getPresets(mockExtensionContext);
	assertEqual(current.length, 0, 'all presets cleared');

	// Reset to default presets
	await resetToDefaultPresets(mockExtensionContext);
	current = getPresets(mockExtensionContext);
	assertEqual(
		current.length,
		DEFAULT_PRESETS.length,
		'presets reset to defaults',
	);

	console.log('Preset management tests passed');

	// Wizard builder tests
	const {
		buildNumberSeq,
		buildAlphaSeq,
		buildDateSeq,
		buildDevOpsSeq,
		buildListSeq,
		buildExprSeq,
	} = require('./components/wizard');

	// Numbers
	assertEqual(
		buildNumberSeq({ start: '1', step: '2', format: '~03d' }),
		'1:2~03d',
		'wizard number seq with step and format',
	);
	assertEqual(
		buildNumberSeq({
			start: '0',
			step: '1',
			repeat: '5',
			frequency: '2',
			startover: '10',
		}),
		'0#5*2##10',
		'wizard number seq with repeat, frequency, startover',
	);
	assertEqual(
		buildNumberSeq({ start: '1', format: '04d' }),
		'1~04d',
		'wizard number seq auto-prepends tilde',
	);

	// Alpha
	assertEqual(
		buildAlphaSeq({ start: 'a', step: '1', caseStyle: 'upper' }),
		'a?u',
		'wizard alpha uppercase',
	);
	assertEqual(
		buildAlphaSeq({
			start: 'B',
			step: '2',
			caseStyle: 'lower',
			format: '~<4',
		}),
		'B?l:2~<4',
		'wizard alpha lowercase step 2 padding',
	);

	// Date & Time
	assertEqual(
		buildDateSeq({ start: '%now', step: '1d', format: '~"yyyy-MM-dd"' }),
		'%now~"yyyy-MM-dd"',
		'wizard date default step omitted',
	);
	assertEqual(
		buildDateSeq({ start: '%2026-01-01', step: '1w', format: '~iso' }),
		'%2026-01-01:1w~iso',
		'wizard date with step and format',
	);

	// DevOps
	assertEqual(
		buildDevOpsSeq({ type: 'uuid-v4' }),
		':uuid',
		'wizard devops uuid v4',
	);
	assertEqual(
		buildDevOpsSeq({ type: 'uuid-v7' }),
		':uuid:v7',
		'wizard devops uuid v7',
	);
	assertEqual(
		buildDevOpsSeq({ type: 'pwd', length: 24 }),
		':pwd:24',
		'wizard devops pwd 24',
	);
	assertEqual(
		buildDevOpsSeq({ type: 'rnd', length: 12 }),
		':rnd:12',
		'wizard devops rnd 12',
	);
	assertEqual(
		buildDevOpsSeq({ type: 'hex', length: 16 }),
		':hex:16',
		'wizard devops hex 16',
	);
	assertEqual(
		buildDevOpsSeq({ type: 'pin', length: 4 }),
		':rnd:4~d',
		'wizard devops pin 4',
	);
	assertEqual(
		buildDevOpsSeq({ type: 'ip', ipStart: '10.0.0.1', ipStep: '2' }),
		'10.0.0.1:2',
		'wizard devops ip',
	);

	// List & Expr
	assertEqual(
		buildListSeq(['apple', 'banana', 'cherry']),
		'["apple","banana","cherry"]',
		'wizard list json',
	);
	assertEqual(
		buildExprSeq('"Item_" + (i+1)'),
		'|"Item_" + (i+1)',
		'wizard expr auto-pipe',
	);

	console.log('Wizard builder tests passed');

	// Validator tests
	const {
		validateSequenceInput,
		cleanErrorMessage,
	} = require('./components/validator');

	// Test cleanErrorMessage
	assertEqual(
		cleanErrorMessage('ReferenceError: myVar is not defined'),
		"'myVar' is not defined",
		'clean error reference message',
	);

	// Parameter mock for validator (German)
	const testValidatorParam: any = {
		segments: rules,
		origCursorPos: [{}, {}],
		origTextSel: ['', ''],
		config: {
			get: (key: string) =>
				key === 'language'
					? 'de'
					: key === 'start'
						? '1'
						: key === 'step'
							? '1'
							: undefined,
		},
	};

	// Parameter mock for validator (English)
	const testValidatorParamEn: any = {
		segments: rules,
		origCursorPos: [{}, {}],
		origTextSel: ['', ''],
		config: {
			get: (key: string) =>
				key === 'language'
					? 'en'
					: key === 'start'
						? '1'
						: key === 'step'
							? '1'
							: undefined,
		},
	};

	// 1. Valid inputs return null
	assertEqual(validateSequenceInput('', testValidatorParam), null, 'empty input is valid');
	assertEqual(validateSequenceInput('1:1~03d', testValidatorParam), null, 'standard number is valid');
	assertEqual(validateSequenceInput('|i + 1', testValidatorParam), null, 'valid expression is valid');
	assertEqual(validateSequenceInput('1:1::i * 2', testValidatorParam), null, 'valid inline expr is valid');
	assertEqual(validateSequenceInput('192.168.1.1:1', testValidatorParam), null, 'valid ip is valid');

	// 2. Standalone expressions
	const exprErr1 = validateSequenceInput('|1 + (', testValidatorParam);
	assertEqual(typeof exprErr1 === 'object' && exprErr1 !== null, true, 'syntax error detected');
	assertEqual(exprErr1.severity, 3, 'syntax error is Error severity');

	const exprErr2 = validateSequenceInput('|unknownVar + 1', testValidatorParam);
	assertEqual(
		exprErr2.message.includes("'unknownVar' is not defined"),
		true,
		'undefined variable error detected',
	);

	// 3. Inline and stop expressions
	const inlineErr = validateSequenceInput('1:1::badFunc()', testValidatorParam);
	assertEqual(
		inlineErr.message.includes("'badFunc' is not defined"),
		true,
		'inline expr error detected',
	);

	const stopErr = validateSequenceInput('1:1@i > > 2', testValidatorParam);
	assertEqual(typeof stopErr === 'object' && stopErr !== null, true, 'stop expr error detected');

	const trailingColon = validateSequenceInput('1:1::', testValidatorParam);
	assertEqual(trailingColon.severity, 1, 'trailing :: returns Info');

	const trailingAt = validateSequenceInput('1:1@', testValidatorParam);
	assertEqual(trailingAt.severity, 1, 'trailing @ returns Info');

	// 4. Templates
	const unclosedQuote = validateSequenceInput('"unclosed template', testValidatorParam);
	assertEqual(unclosedQuote.severity, 2, 'unclosed quote is Warning');

	const unclosedBacktick = validateSequenceInput('`unclosed backtick', testValidatorParam);
	assertEqual(unclosedBacktick.severity, 2, 'unclosed backtick is Warning');

	const unmatchedBrace = validateSequenceInput('`hello }`', testValidatorParam);
	assertEqual(unmatchedBrace.severity, 3, 'unmatched brace is Error');

	// 5. Radices and IP
	const hexErr = validateSequenceInput('0x12G', testValidatorParam);
	assertEqual(hexErr.severity, 3, 'invalid hex is Error');

	const binErr = validateSequenceInput('0b102', testValidatorParam);
	assertEqual(binErr.severity, 3, 'invalid binary is Error');

	const octErr = validateSequenceInput('0o18', testValidatorParam);
	assertEqual(octErr.severity, 3, 'invalid octal is Error');

	const ipOctetErr = validateSequenceInput('192.168.1.300:1', testValidatorParam);
	assertEqual(ipOctetErr.message.includes('überschreitet 255'), true, 'ip octet overflow detected (de)');

	const ipCidrErr = validateSequenceInput('10.0.0.1/35:1', testValidatorParam);
	assertEqual(ipCidrErr.message.includes('0-32'), true, 'ip cidr overflow detected (de)');

	// 6. Dates and DevOps
	const dateErr = validateSequenceInput('%2025-02-31', testValidatorParam);
	assertEqual(dateErr.severity, 3, 'invalid calendar date is Error');

	const uuidErr = validateSequenceInput(':uuid:v99', testValidatorParam);
	assertEqual(uuidErr.message.includes('Unbekannte UUID-Version'), true, 'unknown uuid version detected (de)');

	const tokenErr = validateSequenceInput(':rnd:xyz', testValidatorParam);
	assertEqual(tokenErr.message.includes('Ungültige Länge'), true, 'invalid token length detected (de)');

	// 7. Trailing Operator Syntax Hints (Info)
	const trailingStep = validateSequenceInput('1:', testValidatorParam);
	assertEqual(trailingStep.severity, 1, 'trailing colon returns Info for step');
	assertEqual(trailingStep.message.includes('Schrittweite'), true, 'step hint mentions Schrittweite');

	const trailingFreq = validateSequenceInput('1:2*', testValidatorParam);
	assertEqual(trailingFreq.severity, 1, 'trailing asterisk returns Info for frequency');
	assertEqual(trailingFreq.message.includes('Frequenz'), true, 'frequency hint mentions Frequenz');

	const trailingRep = validateSequenceInput('1:2*3#', testValidatorParam);
	assertEqual(trailingRep.severity, 1, 'trailing hash returns Info for repetition');
	assertEqual(trailingRep.message.includes('Repetition'), true, 'repetition hint mentions Repetition');

	const trailingStartover = validateSequenceInput('1:2##', testValidatorParam);
	assertEqual(trailingStartover.severity, 1, 'trailing double-hash returns Info for startover');
	assertEqual(trailingStartover.message.includes('Neustart'), true, 'startover hint mentions Neustart');

	const trailingFormat = validateSequenceInput('1:2~', testValidatorParam);
	assertEqual(trailingFormat.severity, 1, 'trailing tilde returns Info for format');
	assertEqual(trailingFormat.message.includes('Formatierung'), true, 'format hint mentions Formatierung');

	const trailingAlphaOpt = validateSequenceInput('a?', testValidatorParam);
	assertEqual(trailingAlphaOpt.severity, 1, 'trailing question mark returns Info for alpha casing');
	assertEqual(trailingAlphaOpt.message.includes('Casing'), true, 'casing hint mentions Casing');

	const trailingRndRange = validateSequenceInput('1r', testValidatorParam);
	assertEqual(trailingRndRange.severity, 1, 'trailing r returns Info for random range');
	assertEqual(trailingRndRange.message.includes('Zufallsbereich'), true, 'range hint mentions Zufallsbereich');

	const trailingDateStep = validateSequenceInput('%now:', testValidatorParam);
	assertEqual(trailingDateStep.severity, 1, 'trailing colon on date returns Info for date step');

	const trailingIpStep = validateSequenceInput('192.168.1.1:', testValidatorParam);
	assertEqual(trailingIpStep.severity, 1, 'trailing colon on IP returns Info for IPv4 step');

	const flagDocOrder = validateSequenceInput('1:2$', testValidatorParam);
	assertEqual(flagDocOrder.severity, 1, 'trailing $ returns Info for document order');

	const flagReverse = validateSequenceInput('1:2!', testValidatorParam);
	assertEqual(flagReverse.severity, 1, 'trailing ! returns Info for reverse order');

	// 8. Parameter Semantics Error Checking (Error)
	const badFreq = validateSequenceInput('1*0', testValidatorParam);
	assertEqual(badFreq.severity, 3, 'frequency 0 is Error');
	assertEqual(badFreq.message.includes('Ungültige Frequenz'), true, 'bad frequency message');

	const badRep = validateSequenceInput('1#0', testValidatorParam);
	assertEqual(badRep.severity, 3, 'repetition 0 is Error');
	assertEqual(badRep.message.includes('Ungültige Repetition'), true, 'bad repetition message');

	const badStartover = validateSequenceInput('1##0', testValidatorParam);
	assertEqual(badStartover.severity, 3, 'startover 0 is Error');
	assertEqual(badStartover.message.includes('Ungültiger Neustart'), true, 'bad startover message');

	const badStepNum = validateSequenceInput('1:abc', testValidatorParam);
	assertEqual(badStepNum.severity, 3, 'alphabetic step for decimal is Error');
	assertEqual(badStepNum.message.includes('Ungültige Schrittweite'), true, 'bad step message');

	const badStepAlpha = validateSequenceInput('a:1.5', testValidatorParam);
	assertEqual(badStepAlpha.severity, 3, 'floating point step for alpha is Error');

	const badAlphaOpt = validateSequenceInput('a?xyz', testValidatorParam);
	assertEqual(badAlphaOpt.severity, 3, 'invalid alpha option is Error');

	const badRndRange = validateSequenceInput('1rabc', testValidatorParam);
	assertEqual(badRndRange.severity, 3, 'non-numeric random range upper bound is Error');

	// 9. Fully valid multi-segment sequence
	const fullValid = validateSequenceInput('1:2*3#5~03d', testValidatorParam);
	assertEqual(fullValid, null, 'complete multi-segment sequence returns null (valid)');

	// 10. Ghost-Text Preview tests
	const tabFormatted = formatPreviewText('hello\tworld', 4);
	assertEqual(tabFormatted.includes('\u00A0\u00A0\u00A0\u00A0'), true, 'tabs converted to non-breaking spaces');
	const newlineFormatted = formatPreviewText('line1\nline2');
	assertEqual(newlineFormatted.includes('\u21b5\u00A0'), true, 'newlines converted to return symbol');

	const shortOverflow = buildOverflowPreview(['1', '2', '3'], ', ');
	assertEqual(shortOverflow, '1, 2, 3', 'short overflow joins with delimiter');
	const longOverflow = buildOverflowPreview(['1', '2', '3', '4', '5', '6', '7', '8'], ', ', 5);
	assertEqual(longOverflow, '1, 2, 3, 4, 5 … (+3 more)', 'long overflow truncates cleanly');
	const emptyOverflow = buildOverflowPreview([]);
	assertEqual(emptyOverflow, '', 'empty overflow is empty');

	const ghostConfig = { get: (k: string) => (k === 'previewMode' ? 'ghostText' : undefined) } as any;
	const ghostDec = getPreviewDecorationType(ghostConfig);
	assertEqual((ghostDec as any).options?.after?.color?.id, 'editorGhostText.foreground', 'ghostText uses theme color');
	assertEqual((ghostDec as any).options?.after?.fontStyle, 'italic', 'ghostText uses italic');

	const classicConfig = { get: (k: string) => (k === 'previewMode' ? 'decoration' : k === 'previewColor' ? '#ff0000' : undefined) } as any;
	const classicDec = getPreviewDecorationType(classicConfig);
	assertEqual((classicDec as any).options?.after?.color, '#ff0000', 'classic mode uses previewColor');

	const provider = new InsertSeqInlineCompletionProvider();
	let eventFired = false;
	provider.onDidChangeInlineCompletions(() => { eventFired = true; });
	provider.update([{ insertText: 'test' } as any]);
	assertEqual(eventFired, true, 'update fires onDidChange event');
	const items = provider.provideInlineCompletionItems({} as any, {} as any, {} as any, {} as any);
	assertEqual((items as any)?.items?.length, 1, 'returns completion items');
	eventFired = false;
	provider.clear();
	assertEqual(eventFired, true, 'clear fires onDidChange event');
	const emptyItems = provider.provideInlineCompletionItems({} as any, {} as any, {} as any, {} as any);
	assertEqual(emptyItems, undefined, 'cleared provider returns undefined');
	provider.dispose();

	// 11. Typed Scope Variables in Expression & safeEvaluate (6.1)
	const exprAddNum = runExpression('_ + 1', { _: 1, i: 0, n: 2, s: 1, a: 1, p: 0, o: '', c: '' });
	assertEqual(exprAddNum, 2, '_ + 1 with number _ yields 2 (not "11")');

	const exprIndexMul = runExpression('i * 10 + s', { _: 5, i: 3, n: 5, s: 2, a: 1, p: 4, o: '', c: '' });
	assertEqual(exprIndexMul, 32, 'i * 10 + s yields 32');

	// Decimal sequence with inline expression ::(_ + 1)
	const decSeq = createDecimalSeq('1:1::(_ + 1)', testValidatorParam, 10);
	const decRes0 = decSeq(0);
	assertEqual(decRes0.stringFunction, '2', 'first decimal item with ::(_ + 1) is "2"');
	const decRes1 = decSeq(1);
	assertEqual(decRes1.stringFunction, '3', 'second decimal item with ::(_ + 1) is "3"');

	// Stop condition comparison: numeric vs string comparison
	// In JS, '10' < '5' (lexicographic), but numeric 10 > 5
	const stopCheckTrue = checkStopExpression(0, '_ > 5', 5, {
		currentValueStr: '10',
		valueAfterExpressionStr: '',
		previousValueStr: '',
		currentIndexStr: '0',
		origTextStr: '',
		startStr: '1',
		stepStr: '1',
		numberOfSelectionsStr: '5',
	});
	assertEqual(stopCheckTrue, true, 'checkStopExpression: 10 > 5 is true (numeric comparison)');

	const stopCheckFalse = checkStopExpression(0, '_ > 5', 5, {
		currentValueStr: '2',
		valueAfterExpressionStr: '',
		previousValueStr: '',
		currentIndexStr: '0',
		origTextStr: '',
		startStr: '1',
		stepStr: '1',
		numberOfSelectionsStr: '5',
	});
	assertEqual(stopCheckFalse, false, 'checkStopExpression: 2 > 5 is false');

	// 12. Internationalization (i18n) tests
	const enStep = validateSequenceInput('1:', testValidatorParamEn);
	assertEqual(enStep.severity, 1, 'en step is info');
	assertEqual(enStep.message.includes('Step size'), true, 'en step hint mentions Step size');

	const enFreq = validateSequenceInput('1:2*', testValidatorParamEn);
	assertEqual(enFreq.message.includes('Frequency'), true, 'en freq hint mentions Frequency');

	const enStartover = validateSequenceInput('1:2##', testValidatorParamEn);
	assertEqual(enStartover.message.includes('Restart'), true, 'en startover hint mentions Restart');

	const enBadFreq = validateSequenceInput('1*0', testValidatorParamEn);
	assertEqual(enBadFreq.severity, 3, 'en bad freq is Error');
	assertEqual(enBadFreq.message.includes('Invalid frequency'), true, 'en bad freq message');

	// Direct i18n module tests
	assertEqual(getLanguage(testValidatorParam), 'de', 'detects german language');
	assertEqual(getLanguage(testValidatorParamEn), 'en', 'detects english language');
	assertEqual(getLanguage({ config: { get: () => undefined } } as any), 'en', 'defaults to english');
	assertEqual(t('err_syntax_or_eval', testValidatorParamEn), 'Syntax or evaluation error', 'en translation');
	assertEqual(t('err_syntax_or_eval', testValidatorParam), 'Syntax- oder Auswertungsfehler', 'de translation');
	assertEqual(t('err_invalid_expression', testValidatorParamEn, 'testVar'), 'Invalid expression: testVar', 'placeholder interpolation');
	assertEqual(t('err_invalid_expression', testValidatorParam, 'testVar'), 'Ungültiger Ausdruck: testVar', 'german placeholder interpolation');

	// 13. Atomic Edits with vscode.WorkspaceEdit (6.3)
	const vscodeMod = require('vscode');
	const wsEdit = new vscodeMod.WorkspaceEdit();
	const mockUri = { path: '/test/file.txt' };
	wsEdit.replace(mockUri, { start: 0, end: 5 }, 'replaced text');
	wsEdit.insert(mockUri, { line: 1, character: 0 }, 'inserted line');
	assertEqual(wsEdit.has(mockUri), true, 'wsEdit contains mockUri');
	const editEntries = wsEdit.entries();
	assertEqual(editEntries[0][1].length, 2, 'wsEdit contains 2 operations');
	const applyResult = await vscodeMod.workspace.applyEdit(wsEdit);
	assertEqual(applyResult, true, 'workspace.applyEdit returns true');

	console.log('Validator tests passed');
	console.log('Ghost-text preview tests passed');
	console.log('Typed scope variable and stop condition tests passed');
	console.log('i18n multilingual tests passed');
	console.log('WorkspaceEdit atomic tests passed');
})().catch((err) => {
	console.error('Preset/Wizard/Validator tests failed:', err);
	process.exit(1);
});


