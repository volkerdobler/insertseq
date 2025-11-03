import { format } from 'd3-format';
import { Temporal } from 'temporal-polyfill';

export function formatNumber(value: number, formatString: string): string {
	return format(formatString)(value);
}

export function formatString(value: string, template: string): string {
	// Template syntax: [[fill]align]width[w][lr]
	// Examples: "#<10" => fill '#' left-align width 10
	//           ">10w" => right-align width 10, but return only last char when 'w' present
	const re = /^(.?)([<>\=])?(\d+)(w?)([lr]?)$/;
	const m = template.match(re);
	if (!m) {
		// Fallback: return template as-is if it doesn't match
		return value;
	}

	let fill = m[1] || ' ';
	let align = m[2] || '>';
	const width = parseInt(m[3], 10);
	const wFlag = m[4] === 'w';
	const lrFlag = m[5] || '';

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
	};

	// Replace longer tokens first to avoid partial replacement (e.g. YYYY before YY)
	const keys = Object.keys(tokens).sort((a, b) => b.length - a.length);
	let out = template;
	for (const k of keys) {
		out = out.split(k).join(tokens[k]);
	}

	return out;
}

export function formatTemporalDateTime(
	dateLike: unknown,
	template: string,
	locale = 'default',
): string {
	// Versuche, ein PlainDateTime (Datum mit Zeitzone) zu bekommen.
	let plainDateTime;
	try {
		// Many acceptable inputs (Temporal objects, ISO strings, plain objects) are handled by .from
		plainDateTime = Temporal.PlainDateTime.from(dateLike as any);
	} catch (e) {
		// Falls Input native Date ist, konvertiere über ISO-String
		if (dateLike instanceof Date) {
			plainDateTime = Temporal.PlainDateTime.from(
				dateLike.toISOString().slice(0, 10),
			);
		} else if (typeof dateLike === 'string') {
			// Falls string kein reines Datum ist, versuchen wir ISO-Teil
			const iso = dateLike.slice(0, 10);
			plainDateTime = Temporal.PlainDateTime.from(iso);
		} else {
			throw new Error(
				'Cannot convert provided value to a Temporal PlainDate',
			);
		}
	}

	const year = plainDateTime.year;
	const month = plainDateTime.month; // 1..12
	const day = plainDateTime.day;

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
		HH: String(plainDateTime.hour).padStart(2, '0'),
		H: String(plainDateTime.hour),
		mm: String(plainDateTime.minute).padStart(2, '0'),
		m: String(plainDateTime.minute),
		ss: String(plainDateTime.second).padStart(2, '0'),
		s: String(plainDateTime.second),
	};

	// Längere Keys zuerst ersetzen
	const keys = Object.keys(tokens).sort((a, b) => b.length - a.length);
	let out = template;
	for (const k of keys) {
		out = out.split(k).join(tokens[k]);
	}
	return out;
}
