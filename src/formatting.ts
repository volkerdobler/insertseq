import { format } from 'd3-format';
import { Temporal } from 'temporal-polyfill';

/**
 * Format a number using a d3-format specifier string.
 *
 * @param value - The number to format.
 * @param formatString - A d3-format specifier (e.g. `".2f"`, `"#x"`, `"08d"`).
 * @returns The formatted string.
 * @see https://d3js.org/d3-format
 */
export function formatNumber(value: number, formatString: string): string {
	return format(formatString)(value);
}

/**
 * Pad and align a string value within a fixed-width field.
 *
 * Template syntax: `[[fill]align]width[w][lr]`
 *
 * | Part    | Values          | Meaning                                      |
 * |---------|-----------------|----------------------------------------------|
 * | `fill`  | `0 x \s . _`   | Character used to pad the field              |
 * | `align` | `< > =`        | Left / right / center alignment              |
 * | `width` | integer         | Minimum field width                          |
 * | `w`     | flag            | Use only the last character of `value`       |
 * | `lr`    | `l` or `r`     | Tie-break for centering odd-width remainders |
 *
 * If `value` is already at least as long as `width`, it is returned unchanged.
 *
 * @param value - The string to format.
 * @param template - Format template string (empty string → no-op).
 * @returns The padded/aligned string, or `value` unchanged if the template is invalid.
 */
export function formatString(value: string, template: string): string {
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
	if (fill === '') fill = ' ';

	if (wFlag && value.length > 0) {
		value = value.slice(-1);
	}

	// If value length already >= width, we don't pad; we may still need to return last char for 'w'
	let out: string;
	if (value.length >= width) {
		out = value;
	} else {
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

/**
 * Format a date string using a simple token-based template.
 *
 * Supported tokens (case-sensitive):
 * `yyyy`, `yy`, `MMM`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `mm`, `m`, `ss`, `s`
 *
 * Tokens are replaced in a single pass (longest first) to avoid double
 * substitution (e.g. `MMM` is replaced before `M`).
 *
 * @param value - An ISO date string (e.g. `"2025-11-03"`).
 * @param template - Format template (e.g. `"dd.MM.yyyy"`).
 * @returns The formatted date string, or `value` unchanged if it is not a valid date.
 * @deprecated Not used by the date sequence — see {@link formatTemporalDateTime}.
 */
export function formatDateStr(value: string, template: string): string {
	const date = new Date(value);
	if (isNaN(date.getTime())) return value; // fallback if not a valid date

	const year = date.getFullYear();
	const month = date.getMonth() + 1; // 1-12
	const day = date.getDate();

	const tokens: { [k: string]: string } = {
		yyyy: year.toString(),
		yy: (year % 100).toString().padStart(2, '0'),
		MMM: new Intl.DateTimeFormat('default', { month: 'short' }).format(
			date,
		),
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
	const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const keys = Object.keys(tokens)
		.sort((a, b) => b.length - a.length)
		.map(escapeRegex);
	const reg = new RegExp('(?:' + keys.join('|') + ')', 'g');
	const out = template.replace(reg, (m) => tokens[m] ?? m);
	return out;
}

/**
 * Format a `Temporal.PlainDateTime` using a token-based template string.
 *
 * Supported tokens (case-sensitive, longest matched first):
 * `yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `mm`, `m`, `ss`, `s`
 *
 * If the template contains none of the known tokens (i.e. the output equals
 * the template unchanged), the date is formatted with
 * `toPlainDate().toLocaleString(locale)` as a fallback — this allows passing
 * a bare locale string such as `"de-DE"` as the template.
 *
 * @param temporalDate - The date/time value to format.
 * @param template - Format template or locale string (default `""`).
 * @param locale - BCP 47 locale tag used for localised month names and the
 *   locale-string fallback (e.g. `"de-DE"`).
 * @returns The formatted date string.
 */
export function formatTemporalDateTime(
	temporalDate: Temporal.PlainDateTime,
	template: string = '',
	locale: string | undefined = undefined,
): string {
	const year = temporalDate.year;
	const month = temporalDate.month; // 1..12
	const day = temporalDate.day;

	// Hilfswerte
	const monthShort = new Intl.DateTimeFormat(locale, {
		month: 'short',
	}).format(new Date(Date.UTC(year, month - 1, day)));
	const monthLong = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
		new Date(Date.UTC(year, month - 1, day)),
	);

	const tokens: { [k: string]: string } = {
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
	const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
