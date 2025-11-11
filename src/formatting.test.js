"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const formatting_1 = require("./formatting");
function assertEqual(a, b, msg) {
    if (a !== b)
        throw new Error(`Assertion failed: ${a} !== ${b}. ${msg || ''}`);
}
// Basic padding right (default right-align)
assertEqual((0, formatting_1.formatString)('42', '#<5'), '42###', 'left-align with #'); // left-align with '#'
assertEqual((0, formatting_1.formatString)('42', '>5'), '   42', 'right-align with space'); // right-align with spaces
assertEqual((0, formatting_1.formatString)('42', '0>5'), '00042', 'right-align with 0'); // right-align with '0'
// center
assertEqual((0, formatting_1.formatString)('x', '-=5'), '--x--', 'center 5 width');
assertEqual((0, formatting_1.formatString)('x', '-=6'), '--x---', 'center 6 width - default left bias');
assertEqual((0, formatting_1.formatString)('x', '-=6l'), '--x---', 'center 6 width - left bias');
assertEqual((0, formatting_1.formatString)('x', '-=6r'), '---x--', 'center 6 width - right bias');
assertEqual((0, formatting_1.formatString)('xx', '-=6r'), '--xx--', 'center 6 width - exactly');
// width less than value -> no padding
assertEqual((0, formatting_1.formatString)('abcdef', '3'), 'abcdef', 'no padding when width < value length');
// w flag -> last char
assertEqual((0, formatting_1.formatString)('hello', '>10w'), '         o', 'last char with w flag - hello');
assertEqual((0, formatting_1.formatString)('hi', '#<5w'), 'i####', 'last char with w flag - hi');
console.log('formatting tests passed');
// Example date: 3rd November 2025
const dt = '2025-11-03';
assertEqual((0, formatting_1.formatDateStr)(dt, 'DD.M.YY'), '03.11.25', 'DD.M.YY');
assertEqual((0, formatting_1.formatDateStr)(dt, 'D.M.YYYY'), '3.11.2025', 'D.M.YYYY');
assertEqual((0, formatting_1.formatDateStr)(dt, 'MMM D, YYYY').includes('Nov'), true, 'MMM D, YYYY should include month short text');
assertEqual((0, formatting_1.formatDateStr)(dt, 'YYYY/MM/DD'), '2025/11/03', 'american format');
console.log('date formatting tests passed');
//# sourceMappingURL=formatting.test.js.map