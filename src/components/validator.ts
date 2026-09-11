import * as vscode from 'vscode';
import { TParameter } from '../types';
import { safeEvaluate } from './safeEval';
import { getExpression, getStopExpression, maskPairedAndQuoted } from './utils';
import { Temporal } from 'temporal-polyfill';

export type ValidationResult = vscode.InputBoxValidationMessage | string | null;

/**
 * Cleans up raw JavaScript error strings for user display.
 * (e.g. "ReferenceError: foo is not defined" -> "'foo' is not defined")
 */
export function cleanErrorMessage(err: string): string {
	if (!err) {
		return 'Syntax or evaluation error';
	}
	let msg = err.replace(/^(?:[a-zA-Z]+Error:\s*)+/i, '').trim();
	// Quote bare variable name in "... is not defined"
	msg = msg.replace(/^([a-zA-Z0-9_$]+)\s+is not defined/i, "'$1' is not defined");
	return msg;
}

/**
 * Evaluates a JavaScript expression with test context variables to detect
 * syntax errors and undefined references.
 */
export function testExpressionSyntax(
	expr: string,
	parameter: TParameter,
): { ok: boolean; error?: string } {
	const dummyContext: Record<string, unknown> = {
		_: 1,
		i: 0,
		n: parameter.origCursorPos ? parameter.origCursorPos.length : 1,
		s: 1,
		a: 1,
		p: 0,
		o: (parameter.origTextSel && parameter.origTextSel[0]) || '',
		c: 1,
	};

	const res = safeEvaluate(expr, 500, dummyContext);
	if (!res.ok) {
		return { ok: false, error: cleanErrorMessage(res.error || '') };
	}
	return { ok: true };
}

/**
 * Validates the user's sequence input string live in the InputBox.
 *
 * Checks:
 * - Templates (unclosed quotes, unclosed backticks, unclosed/unmatched braces)
 * - Standalone JS expressions (`|...` or `expr:...`)
 * - Inline JS expressions (`::...`)
 * - Stop conditions (`@...`)
 * - IPv4 addresses and CIDR prefixes
 * - Hex / Octal / Binary radices
 * - Dates & times (`%...`)
 * - DevOps generators (`:uuid:`, `:rnd:`, `:pwd:`)
 *
 * @param input - The current text in the InputBox.
 * @param parameter - Shared command context.
 * @returns An `InputBoxValidationMessage` (Error/Warning/Info), or `null` if valid.
 */
export function validateSequenceInput(
	input: string,
	parameter: TParameter,
): ValidationResult {
	if (!input || input.trim() === '') {
		return null;
	}

	const trimmed = input.trim();
	const masked = maskPairedAndQuoted(trimmed);
	const trimmedMasked = masked.trimEnd();

	// -----------------------------------------------------------------------
	// 1. Backtick template validation
	// -----------------------------------------------------------------------
	if (trimmed.startsWith('`')) {
		const secondTick = trimmed.indexOf('`', 1);
		if (secondTick === -1) {
			return {
				message: 'Unclosed backtick template (missing closing `)',
				severity: vscode.InputBoxValidationSeverity.Warning,
			};
		}
		// Check balanced braces
		let depth = 0;
		for (let idx = 1; idx < secondTick; idx++) {
			if (trimmed[idx] === '{' && (idx === 0 || trimmed[idx - 1] !== '\\')) {
				depth++;
			} else if (trimmed[idx] === '}' && (idx === 0 || trimmed[idx - 1] !== '\\')) {
				depth--;
				if (depth < 0) {
					return {
						message: 'Unmatched "}" in backtick template',
						severity: vscode.InputBoxValidationSeverity.Error,
					};
				}
			}
		}
		if (depth > 0) {
			return {
				message: 'Unclosed "{" in template placeholder',
				severity: vscode.InputBoxValidationSeverity.Warning,
			};
		}
	}

	// -----------------------------------------------------------------------
	// 2. Quoted template validation
	// -----------------------------------------------------------------------
	if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
		const quote = trimmed[0];
		const closingQuote = trimmed.indexOf(quote, 1);
		if (closingQuote === -1) {
			return {
				message: 'Unclosed quote in template',
				severity: vscode.InputBoxValidationSeverity.Warning,
			};
		}
		const templateBody = trimmed.slice(1, closingQuote);
		if (!templateBody.includes('{}')) {
			return {
				message: 'Template string should contain "{}" placeholder for sequence insertion',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
	}

	// -----------------------------------------------------------------------
	// 3. Standalone Expression validation (`|...` or `expr:...`)
	// -----------------------------------------------------------------------
	if (trimmed.startsWith('|') || /^expr:/i.test(trimmed)) {
		const rawExpr = trimmed.startsWith('|')
			? trimmed.slice(1).trim()
			: trimmed.replace(/^expr:/i, '').trim();

		if (!rawExpr) {
			return {
				message: 'Enter a JavaScript expression (e.g. |"item_" + (i+1))',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}

		const test = testExpressionSyntax(rawExpr, parameter);
		if (!test.ok) {
			return {
				message: `Ungültiger Ausdruck: ${test.error}`,
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
		return null;
	}

	// -----------------------------------------------------------------------
	// 4. Inline Expression validation (`::...`)
	// -----------------------------------------------------------------------
	if (/::/i.test(trimmed) || /\bexpr(?:ession)?:/i.test(trimmed)) {
		// Incomplete trailing '::'
		if (/::\s*$/i.test(trimmed) || /\bexpr(?:ession)?:\s*$/i.test(trimmed)) {
			return {
				message: 'Enter a JavaScript expression after "::" (e.g. ::"row_" + _)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		let inlineExpr = getExpression(trimmed, parameter);
		if (!inlineExpr) {
			const match = trimmed.match(/(?:::|\bexpr(?:ession)?:\s*)(.+)/i);
			if (match && match[1]) {
				inlineExpr = match[1].split(/[@$!]/)[0].trim();
			}
		}
		if (inlineExpr) {
			// strip wrapping quotes or brackets if present
			if (
				(inlineExpr.startsWith('"') && inlineExpr.endsWith('"')) ||
				(inlineExpr.startsWith("'") && inlineExpr.endsWith("'")) ||
				(inlineExpr.startsWith('(') && inlineExpr.endsWith(')'))
			) {
				inlineExpr = inlineExpr.slice(1, -1).trim();
			}
			const test = testExpressionSyntax(inlineExpr, parameter);
			if (!test.ok) {
				return {
					message: `Ungültiger Ausdruck (::): ${test.error}`,
					severity: vscode.InputBoxValidationSeverity.Error,
				};
			}
		}
	}

	// -----------------------------------------------------------------------
	// 5. Stop Expression validation (`@...`)
	// -----------------------------------------------------------------------
	if (/@/i.test(trimmed) || /\bstop(?:if)?:/i.test(trimmed)) {
		if (/@\s*$/i.test(trimmed) || /\bstop(?:if)?:\s*$/i.test(trimmed)) {
			return {
				message: 'Enter a stop condition after "@" (e.g. @i>=10)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		let stopExpr = getStopExpression(trimmed, parameter);
		if (!stopExpr) {
			const match = trimmed.match(/(?:@|\bstop(?:if)?:\s*)(.+)/i);
			if (match && match[1]) {
				stopExpr = match[1].split(/[$!]/)[0].trim();
			}
		}
		if (stopExpr) {
			if (
				(stopExpr.startsWith('"') && stopExpr.endsWith('"')) ||
				(stopExpr.startsWith("'") && stopExpr.endsWith("'")) ||
				(stopExpr.startsWith('(') && stopExpr.endsWith(')'))
			) {
				stopExpr = stopExpr.slice(1, -1).trim();
			}
			const test = testExpressionSyntax(stopExpr, parameter);
			if (!test.ok) {
				return {
					message: `Ungültige Stop-Bedingung (@): ${test.error}`,
					severity: vscode.InputBoxValidationSeverity.Error,
				};
			}
		}
	}

	// -----------------------------------------------------------------------
	// 6. Radix number validation (`0x...`, `0b...`, `0o...`)
	// -----------------------------------------------------------------------
	const hexMatch = trimmed.match(/^([+-]?0x)([0-9a-zA-Z_]*)/i);
	if (hexMatch) {
		const hexDigits = hexMatch[2];
		if (!hexDigits) {
			return {
				message: 'Enter hexadecimal digits (0-9, a-f)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/[^0-9a-fA-F_]/.test(hexDigits)) {
			return {
				message: `Invalid hexadecimal number: "${hexMatch[0]}" contains non-hex characters`,
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
	}

	const binMatch = trimmed.match(/^([+-]?0b)([0-9a-zA-Z_]*)/i);
	if (binMatch) {
		const binDigits = binMatch[2];
		if (!binDigits) {
			return {
				message: 'Enter binary digits (0 or 1)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/[^01_]/.test(binDigits)) {
			return {
				message: `Invalid binary number: "${binMatch[0]}" contains non-binary characters`,
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
	}

	const octMatch = trimmed.match(/^([+-]?0o)([0-9a-zA-Z_]*)/i);
	if (octMatch) {
		const octDigits = octMatch[2];
		if (!octDigits) {
			return {
				message: 'Enter octal digits (0-7)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/[^0-7_]/.test(octDigits)) {
			return {
				message: `Invalid octal number: "${octMatch[0]}" contains non-octal characters`,
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
	}

	// -----------------------------------------------------------------------
	// 7. IPv4 address validation
	// -----------------------------------------------------------------------
	const ipMatch = trimmed.match(/^(\d{1,4}\.\d{1,4}\.\d{1,4}\.\d{1,4})(?:\/(\d+))?/);
	if (ipMatch) {
		const octets = ipMatch[1].split('.').map(Number);
		for (const oct of octets) {
			if (oct > 255) {
				return {
					message: `Invalid IPv4 address: octet exceeds 255 (found ${oct})`,
					severity: vscode.InputBoxValidationSeverity.Error,
				};
			}
		}
		if (ipMatch[2] !== undefined) {
			const prefix = Number(ipMatch[2]);
			if (prefix > 32) {
				return {
					message: `Invalid IPv4 CIDR prefix /${prefix} (must be 0-32)`,
					severity: vscode.InputBoxValidationSeverity.Error,
				};
			}
		}
	}

	// -----------------------------------------------------------------------
	// 8. Date & Time validation (`%...`)
	// -----------------------------------------------------------------------
	if (trimmed.startsWith('%')) {
		const datePartMatch = trimmed.match(/^%([^:~#*@$!]+)/);
		if (datePartMatch) {
			const dateStr = datePartMatch[1].trim();
			// If not a keyword like 'now' or 'date'
			if (dateStr && dateStr !== 'now' && dateStr !== 'date') {
				// Check clock time HH:mm(:ss)?
				if (/^\d{1,2}:\d{1,2}(?::\d{1,2})?$/.test(dateStr)) {
					const [hh, mm, ss] = dateStr.split(':').map(Number);
					if (hh > 23 || mm > 59 || (ss !== undefined && ss > 59)) {
						return {
							message: `Invalid time "${dateStr}": hours must be 0-23 and minutes/seconds 0-59`,
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				} else if (/^\d{4}-\d{1,2}-\d{1,2}/.test(dateStr)) {
					try {
						Temporal.PlainDate.from(dateStr);
					} catch (e: any) {
						return {
							message: `Invalid date "${dateStr}": ${cleanErrorMessage(e?.message || '')}`,
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				}
			}
		}
	}

	// -----------------------------------------------------------------------
	// 9. DevOps & Utilities validation (`:uuid:`, `:rnd:`, `:pwd:`)
	// -----------------------------------------------------------------------
	if (/^:uuid(?::([^:~#*@$!]+))?/i.test(trimmed)) {
		const uuidMatch = trimmed.match(/^:uuid(?::([^:~#*@$!]+))?/i);
		if (uuidMatch && uuidMatch[1]) {
			const ver = uuidMatch[1].toLowerCase().trim();
			if (ver !== 'v4' && ver !== 'v7' && ver !== '4' && ver !== '7') {
				return {
					message: `Unknown UUID version "${ver}": only v4 and v7 are supported`,
					severity: vscode.InputBoxValidationSeverity.Error,
				};
			}
		}
	}

	if (/^:(?:rnd|random|pwd|password|hex|token):([^:~#*@$!]+)/i.test(trimmed)) {
		const tokenMatch = trimmed.match(
			/^:(?:rnd|random|pwd|password|hex|token):([^:~#*@$!]+)/i,
		);
		if (tokenMatch && tokenMatch[1]) {
			const len = Number(tokenMatch[1].trim());
			if (isNaN(len) || len <= 0) {
				return {
					message: `Invalid length "${tokenMatch[1]}": expected a positive number`,
					severity: vscode.InputBoxValidationSeverity.Error,
				};
			}
		}
	}

	// -----------------------------------------------------------------------
	// 10. Trailing Operator / Incomplete Input Hints (Severity: Info)
	// (Immediate contextual syntax help during typing)
	// -----------------------------------------------------------------------
	// Trailing '##' or 'startover:'
	if (/##\s*$/i.test(trimmedMasked) || /\bstart(?:over|again)?:\s*$/i.test(trimmedMasked)) {
		return {
			message: '##<startover> – Neustart: Sequenz alle N Werte neu starten (z. B. ##10)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing single '#' or 'rep:'
	if (/(?<!#)#\s*$/i.test(trimmedMasked) || /\brep(?:eat|etition)?:\s*$/i.test(trimmedMasked)) {
		return {
			message: '#<repeat> – Repetition / Zyklus: Sequenz nach N Werten wiederholen (z. B. #5)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing '*' or 'freq:'
	if (/\*\s*$/i.test(trimmedMasked) || /\bfreq(?:uency)?:\s*$/i.test(trimmedMasked)) {
		return {
			message: '*<frequency> – Frequenz: jeden Wert N-mal wiederholen (z. B. *2)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing '~' or 'format:'
	if (/~\s*$/i.test(trimmedMasked) || /\bformat:\s*$/i.test(trimmedMasked)) {
		return {
			message: '~<format> – Formatierung (z. B. ~03d für Padding, ~>10 für Ausrichtung, ~hex, ~bin, ~roman)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing '?' or 'opt:'
	if (/\?\s*$/i.test(trimmedMasked) || /\bopt(?:ions?)?:\s*$/i.test(trimmedMasked)) {
		return {
			message: '?<option> – Casing / Option (?u = GROSS, ?l = klein, ?p = PascalCase)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing '_' (delimiter)
	if (/(?<!_)_\s*$/i.test(trimmedMasked) || /\bdelimiter:\s*$/i.test(trimmedMasked)) {
		return {
			message: '_<delim> – Benutzerdefiniertes Trennzeichen (z. B. _, oder _-)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing 'r' directly preceded by a number (random range)
	if (/[+-]?(?:0[xob])?\d+(?:\.\d+)?r\s*$/i.test(trimmedMasked)) {
		return {
			message: 'r<max> – Zufallsbereich: Obergrenze angeben (z. B. 1r10 = Zufallszahlen zwischen 1 und 10)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing single colon ':' (step size or DevOps trigger)
	if (/(?<!:):(?!\s*:)\s*$/i.test(trimmedMasked)) {
		if (trimmedMasked === ':') {
			return {
				message: ':<step> (Schrittweite) oder Spezialsequenz (:uuid, :rnd:<Länge>, :pwd:<Länge>, :ip)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:(?:rnd|random):?\s*$/i.test(trimmedMasked)) {
			return {
				message: ':rnd:<Länge> – Alphanumerischer Zufallstoken (z. B. :rnd:16)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:(?:pwd|password):?\s*$/i.test(trimmedMasked)) {
			return {
				message: ':pwd:<Länge> – Sicheres Zufallspasswort (z. B. :pwd:16)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:(?:hex|hash):?\s*$/i.test(trimmedMasked)) {
			return {
				message: ':hex:<Länge> – Hexadezimaler Hash/Token (z. B. :hex:32)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:(?:token):?\s*$/i.test(trimmedMasked)) {
			return {
				message: ':token:<Länge> – URL-sicherer Token (z. B. :token:24)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:uuid:?\s*$/i.test(trimmedMasked)) {
			return {
				message: ':uuid[:<version>] – UUID-Generator (Standard v4, oder :uuid:v7)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (
			/^:(?:ip|ipv4):?\s*$/i.test(trimmedMasked) ||
			/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d+)?:?\s*$/i.test(trimmedMasked)
		) {
			return {
				message: ':<step> – IPv4-Schrittweite (z. B. :1, :-1)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^%|^date:/i.test(trimmedMasked)) {
			return {
				message: ':<step> – Datumsschrittweite (z. B. :1d, :2w, :1m, :1y, :1h, :15min)',
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		return {
			message: ':<step> – Schrittweite / Step size (z. B. :2, :-1)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Incomplete keyword 'step:'
	if (/\bstep(?:s)?:\s*$/i.test(trimmedMasked)) {
		return {
			message: 'step:<step> – Schrittweite / Step size (z. B. step:2, step:-1)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Single trigger characters at beginning of input
	if (trimmedMasked === ';') {
		return {
			message: ';<name> – Vordefinierte Liste aus Einstellungen (z. B. ;Jan, ;?1)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked === '=') {
		return {
			message: '=<name> – Reusable Function aus Einstellungen (z. B. =1, =2;5)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked === '%') {
		return {
			message: '%<date/time> – Datum oder Uhrzeit (z. B. %now, %today, %2026-01-01, %14:00)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked === ':uuid') {
		return {
			message: ':uuid[:<version>] – UUID-Generator (Standard v4, oder :uuid:v7)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked === ':ip') {
		return {
			message: ':ip[:<step>] – IPv4-Sequenz mit Default-IP aus Einstellungen (z. B. :ip:1)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (/^:(?:rnd|random|pwd|password|hex|hash|token)$/i.test(trimmedMasked)) {
		return {
			message: `${trimmedMasked}:<Länge> – Länge angeben (z. B. ${trimmedMasked}:16)`,
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Suffix flags ($ or !)
	if (trimmedMasked.endsWith('$')) {
		return {
			message: '$ – Dokument-Reihenfolge aktiviert (von oben nach unten einfügen)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked.endsWith('!')) {
		return {
			message: '! – Reihenfolge umkehren aktiviert (invers einfügen)',
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// -----------------------------------------------------------------------
	// 11. Parameter Semantics Validation (Severity: Error)
	// (Step, Frequency, Repetition, Startover, Alpha options, Random range)
	// -----------------------------------------------------------------------
	const exprIdx = masked.search(/::|\bexpr(?:ession)?:/i);
	const stopIdx = masked.search(/@|\bstop(?:if)?:\s*/i);
	let endIdx = masked.length;
	if (exprIdx !== -1 && exprIdx < endIdx) {
		endIdx = exprIdx;
	}
	if (stopIdx !== -1 && stopIdx < endIdx) {
		endIdx = stopIdx;
	}

	const controlPart = trimmed.slice(0, endIdx).trim();

	// Check Frequency
	const freqMatch = controlPart.match(/(?:\*|\bfreq(?:uency)?:\s*)([^\s:~#*@$!|]+)/i);
	if (freqMatch && freqMatch[1]) {
		const val = freqMatch[1].trim();
		if (!/^\d+$/.test(val) || Number(val) <= 0) {
			return {
				message: `Ungültige Frequenz "${val}": Erwartet eine positive Ganzzahl > 0 (z. B. *2)`,
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
	}

	// Check Repetition
	const repMatch = controlPart.match(
		/(?<!#)#(?!#)\s*([^\s:~#*@$!|]+)|\brep(?:eat|etition)?:\s*([^\s:~#*@$!|]+)/i,
	);
	if (repMatch) {
		const val = (repMatch[1] || repMatch[2] || '').trim();
		if (val && (!/^\d+$/.test(val) || Number(val) <= 0)) {
			return {
				message: `Ungültige Repetition "${val}": Erwartet eine positive Ganzzahl > 0 (z. B. #5)`,
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
	}

	// Check Startover
	const soMatch = controlPart.match(/(?:##|\bstart(?:over|again)?:\s*)([^\s:~#*@$!|]+)/i);
	if (soMatch && soMatch[1]) {
		const val = soMatch[1].trim();
		if (!/^\d+$/.test(val) || Number(val) <= 0) {
			return {
				message: `Ungültiger Neustart (startover) "${val}": Erwartet eine positive Ganzzahl > 0 (z. B. ##10)`,
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
	}

	// Check Random range upper bound
	const rndRangeMatch = controlPart.match(
		/^([+-]?(?:0[xob])?\d+(?:\.\d+)?)r([^\s:~#*@$!|]+)/i,
	);
	if (rndRangeMatch && rndRangeMatch[2]) {
		const endVal = rndRangeMatch[2].trim();
		if (isNaN(Number(endVal))) {
			return {
				message: `Ungültiger Zufallsbereich: "${endVal}" ist keine gültige Obergrenze (z. B. 1r10)`,
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
	}

	// Check Alpha options
	if (/^[a-zA-Z]\b/.test(controlPart) || /^alpha:/i.test(controlPart)) {
		const optMatch = controlPart.match(/\?(?:opt(?:ions?)?:)?([a-zA-Z]+)/i);
		if (optMatch && optMatch[1]) {
			const optVal = optMatch[1].trim();
			if (/[^ulpULP]/.test(optVal)) {
				return {
					message: `Ungültige Buchstaben-Option "?${optVal}": Erlaubt sind ?u (Groß), ?l (Klein), ?p (PascalCase)`,
					severity: vscode.InputBoxValidationSeverity.Error,
				};
			}
		}
	}

	// Check Step
	const isDevOpsGen = /^:(?:uuid|rnd|random|pwd|password|hex|hash|token)/i.test(controlPart);
	if (!isDevOpsGen) {
		const stepMatch = controlPart.match(
			/(?<!:):(?!:)\s*([^\s:~#*@$!|]+)|\bstep(?:s)?:\s*([^\s:~#*@$!|]+)/i,
		);
		if (stepMatch) {
			const val = (stepMatch[1] || stepMatch[2] || '').trim();
			if (val) {
				const isDate = /^%|^date:/i.test(controlPart);
				const isIp =
					/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(controlPart) ||
					/^:(?:ip|ipv4)/i.test(controlPart);
				const isAlpha =
					/^[a-zA-Z]\b/.test(controlPart) || /^alpha:/i.test(controlPart);
				const isNumeric = /^[+-]?(?:0[xob])?\d+/i.test(controlPart);

				if (isDate) {
					const dateUnitOk =
						/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)\s*(?:d(?:ay(?:s)?)?|w(?:eek(?:s)?)?|m(?:onth(?:s)?)?|y(?:ear(?:s)?)?|h(?:our(?:s)?)?|min(?:ute(?:s)?)?|s(?:ec(?:ond(?:s)?)?)?|ms)?$/i.test(
							val,
						);
					if (!dateUnitOk) {
						return {
							message: `Ungültige Datumsschrittweite "${val}": Erwartet z. B. :1d, :2w, :1m, :1y, :1h, :15min`,
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				} else if (isIp) {
					if (!/^[+-]?\d+$/.test(val)) {
						return {
							message: `Ungültige IPv4-Schrittweite "${val}": Erwartet eine Ganzzahl (z. B. :1, :-1)`,
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				} else if (isAlpha) {
					if (!/^[+-]?\d+$/.test(val)) {
						return {
							message: `Ungültige Schrittweite "${val}": Erwartet eine Ganzzahl für Buchstaben (z. B. :1, :2, :-1)`,
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				} else if (isNumeric) {
					if (isNaN(Number(val))) {
						return {
							message: `Ungültige Schrittweite "${val}": Erwartet eine Zahl (z. B. :2, :-1, :0.5)`,
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				}
			}
		}
	}

	return null;
}
