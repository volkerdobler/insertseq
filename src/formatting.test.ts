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
			workspace: {
				getConfiguration: () => ({
					get: (key: string) => mockConfigStore[key],
					update: async (key: string, value: any) => {
						mockConfigStore[key] = value;
					},
				}),
			},
			window: {
				createOutputChannel: () => ({
					appendLine: () => {},
					dispose: () => {},
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
})().catch((err) => {
	console.error('Preset/Wizard tests failed:', err);
	process.exit(1);
});

