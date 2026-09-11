import * as vscode from 'vscode';
import { TParameter } from '../types';
import { safeEvaluate } from './safeEval';
import { getExpression, getStopExpression, maskPairedAndQuoted } from './utils';
import { Temporal } from 'temporal-polyfill';
import { t } from '../i18n';

export type ValidationResult = vscode.InputBoxValidationMessage | string | null;

/**
 * Cleans up raw JavaScript error strings for user display.
 * (e.g. "ReferenceError: foo is not defined" -> "'foo' is not defined")
 */
export function cleanErrorMessage(err: string, parameter?: TParameter): string {
	if (!err) {
		return t('err_syntax_or_eval', parameter);
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
				message: t('err_unclosed_backtick', parameter),
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
						message: t('err_unmatched_brace', parameter),
						severity: vscode.InputBoxValidationSeverity.Error,
					};
				}
			}
		}
		if (depth > 0) {
			return {
				message: t('err_unclosed_brace', parameter),
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
				message: t('err_unclosed_quote', parameter),
				severity: vscode.InputBoxValidationSeverity.Warning,
			};
		}
		const templateBody = trimmed.slice(1, closingQuote);
		if (!templateBody.includes('{}')) {
			return {
				message: t('info_template_placeholder', parameter),
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
				message: t('info_enter_standalone_expr', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}

		const test = testExpressionSyntax(rawExpr, parameter);
		if (!test.ok) {
			return {
				message: t('err_invalid_expression', parameter, test.error || ''),
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
				message: t('info_enter_inline_expr', parameter),
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
					message: t('err_invalid_inline_expr', parameter, test.error || ''),
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
				message: t('info_enter_stop_expr', parameter),
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
					message: t('err_invalid_stop_expr', parameter, test.error || ''),
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
				message: t('info_enter_hex_digits', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/[^0-9a-fA-F_]/.test(hexDigits)) {
			return {
				message: t('err_invalid_hex', parameter, hexMatch[0]),
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
	}

	const binMatch = trimmed.match(/^([+-]?0b)([0-9a-zA-Z_]*)/i);
	if (binMatch) {
		const binDigits = binMatch[2];
		if (!binDigits) {
			return {
				message: t('info_enter_bin_digits', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/[^01_]/.test(binDigits)) {
			return {
				message: t('err_invalid_bin', parameter, binMatch[0]),
				severity: vscode.InputBoxValidationSeverity.Error,
			};
		}
	}

	const octMatch = trimmed.match(/^([+-]?0o)([0-9a-zA-Z_]*)/i);
	if (octMatch) {
		const octDigits = octMatch[2];
		if (!octDigits) {
			return {
				message: t('info_enter_oct_digits', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/[^0-7_]/.test(octDigits)) {
			return {
				message: t('err_invalid_oct', parameter, octMatch[0]),
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
					message: t('err_invalid_ip_octet', parameter, oct),
					severity: vscode.InputBoxValidationSeverity.Error,
				};
			}
		}
		if (ipMatch[2] !== undefined) {
			const prefix = Number(ipMatch[2]);
			if (prefix > 32) {
				return {
					message: t('err_invalid_ip_cidr', parameter, prefix),
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
							message: t('err_invalid_time', parameter, dateStr),
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				} else if (/^\d{4}-\d{1,2}-\d{1,2}/.test(dateStr)) {
					try {
						Temporal.PlainDate.from(dateStr);
					} catch (e: any) {
						return {
							message: t(
								'err_invalid_date',
								parameter,
								dateStr,
								cleanErrorMessage(e?.message || ''),
							),
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
					message: t('err_unknown_uuid', parameter, ver),
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
					message: t(
						'err_invalid_token_len',
						parameter,
						tokenMatch[1],
					),
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
			message: t('hint_startover', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing single '#' or 'rep:'
	if (/(?<!#)#\s*$/i.test(trimmedMasked) || /\brep(?:eat|etition)?:\s*$/i.test(trimmedMasked)) {
		return {
			message: t('hint_repeat', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing '*' or 'freq:'
	if (/\*\s*$/i.test(trimmedMasked) || /\bfreq(?:uency)?:\s*$/i.test(trimmedMasked)) {
		return {
			message: t('hint_frequency', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing '~' or 'format:'
	if (/~\s*$/i.test(trimmedMasked) || /\bformat:\s*$/i.test(trimmedMasked)) {
		return {
			message: t('hint_format', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing '?' or 'opt:'
	if (/\?\s*$/i.test(trimmedMasked) || /\bopt(?:ions?)?:\s*$/i.test(trimmedMasked)) {
		return {
			message: t('hint_casing', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing '_' (delimiter)
	if (/(?<!_)_\s*$/i.test(trimmedMasked) || /\bdelimiter:\s*$/i.test(trimmedMasked)) {
		return {
			message: t('hint_delim', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing 'r' directly preceded by a number (random range)
	if (/[+-]?(?:0[xob])?\d+(?:\.\d+)?r\s*$/i.test(trimmedMasked)) {
		return {
			message: t('hint_random_range', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Trailing single colon ':' (step size or DevOps trigger)
	if (/(?<!:):(?!\s*:)\s*$/i.test(trimmedMasked)) {
		if (trimmedMasked === ':') {
			return {
				message: t('hint_step_or_devops', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:(?:rnd|random):?\s*$/i.test(trimmedMasked)) {
			return {
				message: t('hint_rnd_len', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:(?:pwd|password):?\s*$/i.test(trimmedMasked)) {
			return {
				message: t('hint_pwd_len', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:(?:hex|hash):?\s*$/i.test(trimmedMasked)) {
			return {
				message: t('hint_hex_len', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:(?:token):?\s*$/i.test(trimmedMasked)) {
			return {
				message: t('hint_token_len', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^:uuid:?\s*$/i.test(trimmedMasked)) {
			return {
				message: t('hint_uuid', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (
			/^:(?:ip|ipv4):?\s*$/i.test(trimmedMasked) ||
			/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d+)?:?\s*$/i.test(trimmedMasked)
		) {
			return {
				message: t('hint_ip_step', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		if (/^%|^date:/i.test(trimmedMasked)) {
			return {
				message: t('hint_date_step', parameter),
				severity: vscode.InputBoxValidationSeverity.Info,
			};
		}
		return {
			message: t('hint_step', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Incomplete keyword 'step:'
	if (/\bstep(?:s)?:\s*$/i.test(trimmedMasked)) {
		return {
			message: t('hint_step_keyword', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Single trigger characters at beginning of input
	if (trimmedMasked === ';') {
		return {
			message: t('hint_list', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked === '=') {
		return {
			message: t('hint_function', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked === '%') {
		return {
			message: t('hint_date', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked === ':uuid') {
		return {
			message: t('hint_uuid', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked === ':ip') {
		return {
			message: t('hint_ip_default', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (/^:(?:rnd|random|pwd|password|hex|hash|token)$/i.test(trimmedMasked)) {
		return {
			message: t(
				'hint_devops_specify_len',
				parameter,
				trimmedMasked,
			),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}

	// Suffix flags ($ or !)
	if (trimmedMasked.endsWith('$')) {
		return {
			message: t('hint_doc_order', parameter),
			severity: vscode.InputBoxValidationSeverity.Info,
		};
	}
	if (trimmedMasked.endsWith('!')) {
		return {
			message: t('hint_reverse_order', parameter),
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
				message: t('err_invalid_frequency', parameter, val),
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
				message: t('err_invalid_repetition', parameter, val),
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
				message: t('err_invalid_startover', parameter, val),
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
				message: t('err_invalid_random_range', parameter, endVal),
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
					message: t('err_invalid_alpha_option', parameter, optVal),
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
							message: t('err_invalid_date_step', parameter, val),
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				} else if (isIp) {
					if (!/^[+-]?\d+$/.test(val)) {
						return {
							message: t('err_invalid_ip_step', parameter, val),
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				} else if (isAlpha) {
					if (!/^[+-]?\d+$/.test(val)) {
						return {
							message: t('err_invalid_alpha_step', parameter, val),
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				} else if (isNumeric) {
					if (isNaN(Number(val))) {
						return {
							message: t('err_invalid_numeric_step', parameter, val),
							severity: vscode.InputBoxValidationSeverity.Error,
						};
					}
				}
			}
		}
	}

	return null;
}
