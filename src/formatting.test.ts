import { formatString, formatDateStr } from './formatting';

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

// Example date: 3rd November 2025
const dt = '2025-11-03';
assertEqual(formatDateStr(dt, 'DD.M.YY'), '03.11.25', 'DD.M.YY');
assertEqual(formatDateStr(dt, 'D.M.YYYY'), '3.11.2025', 'D.M.YYYY');
assertEqual(
	formatDateStr(dt, 'MMM D, YYYY').includes('Nov'),
	true,
	'MMM D, YYYY should include month short text',
);
assertEqual(formatDateStr(dt, 'YYYY/MM/DD'), '2025/11/03', 'american format');

console.log('date formatting tests passed');
