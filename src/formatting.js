"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatNumber = formatNumber;
exports.formatString = formatString;
exports.formatDateStr = formatDateStr;
exports.formatTemporalDateTime = formatTemporalDateTime;
const d3_format_1 = require("d3-format");
function formatNumber(value, formatString) {
    return (0, d3_format_1.format)(formatString)(value);
}
function formatString(value, template) {
    // Template syntax: [[fill]align]width[w][lr]
    // Examples: "#<10" => fill '#' left-align width 10
    //           ">10w" => right-align width 10, but return only last char when 'w' present
    const re = /^([0x\s\._]?)([<>\=])?(\d+)?([wW]?)([lrLR]?)$/;
    const m = template.match(re);
    if (!m) {
        // Fallback: return template as-is if it doesn't match
        return value;
    }
    let fill = m[1] || ' ';
    let align = m[2] || '>';
    const width = m[3] ? parseInt(m[3], 10) : 0;
    const wFlag = m[4]?.toLowerCase() === 'w';
    const lrFlag = m[5]?.toLowerCase() || '';
    // If the first capture is actually an align char (because fill was omitted),
    // adjust accordingly. e.g. template "<10" -> m[1] = '<', m[2] = undefined
    if (['<', '>', '='].includes(fill)) {
        // shift: no fill provided
        align = fill;
        fill = ' ';
    }
    // If fill is empty string (shouldn't happen), default to space
    if (fill === '')
        fill = ' ';
    if (wFlag && value.length > 0) {
        value = value.slice(-1);
    }
    // If value length already >= width, we don't pad; we may still need to return last char for 'w'
    let out;
    if (value.length >= width) {
        out = value;
    }
    else {
        const padLen = width - value.length;
        switch (align) {
            case '<':
                out = value + fill.repeat(padLen);
                break;
            case '=': // center
                const left = Math.floor(padLen / 2);
                const right = padLen - left;
                switch (lrFlag) {
                    case 'l':
                    default:
                        // left bias if needed
                        out = fill.repeat(left) + value + fill.repeat(right);
                        break;
                    case 'r':
                        // right bias if needed
                        out = fill.repeat(right) + value + fill.repeat(left);
                        break;
                }
                break;
            case '>':
            default:
                out = fill.repeat(padLen) + value;
                break;
        }
    }
    return out;
}
function formatDateStr(value, template) {
    const date = new Date(value);
    if (isNaN(date.getTime()))
        return value; // fallback if not a valid date
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate();
    const tokens = {
        yyyy: year.toString(),
        yy: (year % 100).toString().padStart(2, '0'),
        MMM: new Intl.DateTimeFormat('default', { month: 'short' }).format(date),
        MM: month.toString().padStart(2, '0'),
        M: month.toString(),
        dd: day.toString().padStart(2, '0'),
        d: day.toString(),
        HH: date.getHours().toString().padStart(2, '0'),
        H: date.getHours().toString(),
        mm: date.getMinutes().toString().padStart(2, '0'),
        m: date.getMinutes().toString(),
        ss: date.getSeconds().toString().padStart(2, '0'),
        s: date.getSeconds().toString(),
    };
    // Replace tokens in a single pass using a regex built from the keys.
    // This avoids replacing characters inside already-inserted replacements
    // (e.g. MMMM -> 'Mai' later being touched by 'M').
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keys = Object.keys(tokens)
        .sort((a, b) => b.length - a.length)
        .map(escapeRegex);
    const reg = new RegExp('(?:' + keys.join('|') + ')', 'g');
    const out = template.replace(reg, (m) => tokens[m] ?? m);
    return out;
}
function formatTemporalDateTime(temporalDate, template = '', locale = undefined) {
    const year = temporalDate.year;
    const month = temporalDate.month; // 1..12
    const day = temporalDate.day;
    // Hilfswerte
    const monthShort = new Intl.DateTimeFormat(locale, {
        month: 'short',
    }).format(new Date(Date.UTC(year, month - 1, day)));
    const monthLong = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(Date.UTC(year, month - 1, day)));
    const tokens = {
        yyyy: String(year).padStart(4, '0'),
        yy: String(year % 100).padStart(2, '0'),
        MMMM: monthLong,
        MMM: monthShort,
        MM: String(month).padStart(2, '0'),
        M: String(month),
        dd: String(day).padStart(2, '0'),
        d: String(day),
        HH: String(temporalDate.hour).padStart(2, '0'),
        H: String(temporalDate.hour),
        mm: String(temporalDate.minute).padStart(2, '0'),
        m: String(temporalDate.minute),
        ss: String(temporalDate.second).padStart(2, '0'),
        s: String(temporalDate.second),
    };
    // Replace tokens in a single pass (match longest tokens first in regex)
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keys = Object.keys(tokens)
        .sort((a, b) => b.length - a.length)
        .map(escapeRegex);
    const reg = new RegExp('(?:' + keys.join('|') + ')', 'g');
    const out = template.replace(reg, (m) => tokens[m] ?? m);
    if (out === template) {
        return temporalDate.toPlainDate().toLocaleString(locale);
    }
    return out;
}
//# sourceMappingURL=formatting.js.map