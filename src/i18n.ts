import * as vscode from 'vscode';
import { TParameter } from './types';

export type Language = 'en' | 'de';

export const translations = {
	en: {
		// General / Syntax
		err_syntax_or_eval: 'Syntax or evaluation error',
		err_unclosed_backtick: 'Unclosed backtick template (missing closing `)',
		err_unmatched_brace: 'Unmatched "}" in backtick template',
		err_unclosed_brace: 'Unclosed "{" in template placeholder',
		err_unclosed_quote: 'Unclosed quote in template',
		info_template_placeholder:
			'Template string should contain "{}" placeholder for sequence insertion',
		info_enter_standalone_expr:
			'Enter a JavaScript expression (e.g. |"item_" + (i+1))',
		err_invalid_expression: 'Invalid expression: {0}',
		info_enter_inline_expr:
			'Enter a JavaScript expression after "::" (e.g. ::"row_" + _)',
		err_invalid_inline_expr: 'Invalid expression (::): {0}',
		info_enter_stop_expr:
			'Enter a stop condition after "@" (e.g. @i>=10)',
		err_invalid_stop_expr: 'Invalid stop condition (@): {0}',
		info_enter_hex_digits: 'Enter hexadecimal digits (0-9, a-f)',
		err_invalid_hex:
			'Invalid hexadecimal number: "{0}" contains non-hex characters',
		info_enter_bin_digits: 'Enter binary digits (0 or 1)',
		err_invalid_bin:
			'Invalid binary number: "{0}" contains non-binary characters',
		info_enter_oct_digits: 'Enter octal digits (0-7)',
		err_invalid_oct:
			'Invalid octal number: "{0}" contains non-octal characters',
		err_invalid_ip_octet:
			'Invalid IPv4 address: octet exceeds 255 (found {0})',
		err_invalid_ip_cidr:
			'Invalid IPv4 CIDR prefix /{0} (must be 0-32)',
		err_invalid_time:
			'Invalid time "{0}": hours must be 0-23 and minutes/seconds 0-59',
		err_invalid_date: 'Invalid date "{0}": {1}',
		err_unknown_uuid:
			'Unknown UUID version "{0}": only v4 and v7 are supported',
		err_invalid_token_len:
			'Invalid length "{0}": expected a positive number',

		// Trailing / Contextual Operator Hints
		hint_startover:
			'##<startover> – Restart: restart sequence every N values (e.g. ##10)',
		hint_repeat:
			'#<repeat> – Repeat: repeat sequence after N values (e.g. #5)',
		hint_frequency:
			'*<frequency> – Frequency: repeat each value N times (e.g. *2)',
		hint_format:
			'~<format> – Format (e.g. ~03d for padding, ~>10 for alignment, ~hex, ~bin, ~roman)',
		hint_casing:
			'?<option> – Casing / Option (?u = UPPER, ?l = lower, ?p = PascalCase)',
		hint_delim: '_<delim> – Custom delimiter (e.g. _, or _-)',
		hint_random_range:
			'r<max> – Random range: specify upper bound (e.g. 1r10 = random numbers between 1 and 10)',
		hint_step_or_devops:
			':<step> (step size) or special generator (:uuid, :rnd:<length>, :pwd:<length>, :ip)',
		hint_rnd_len:
			':rnd:<length> – Alphanumeric random token (e.g. :rnd:16)',
		hint_pwd_len:
			':pwd:<length> – Secure random password (e.g. :pwd:16)',
		hint_hex_len:
			':hex:<length> – Hexadecimal hash/token (e.g. :hex:32)',
		hint_token_len:
			':token:<length> – URL-safe token (e.g. :token:24)',
		hint_uuid:
			':uuid[:<version>] – UUID generator (default v4, or :uuid:v7)',
		hint_ip_step: ':<step> – IPv4 step size (e.g. :1, :-1)',
		hint_date_step:
			':<step> – Date step size (e.g. :1d, :2w, :1m, :1y, :1h, :15min)',
		hint_step: ':<step> – Step size (e.g. :2, :-1)',
		hint_step_keyword: 'step:<step> – Step size (e.g. step:2, step:-1)',
		hint_list:
			';<name> – Predefined list from settings (e.g. ;Jan, ;?1)',
		hint_function:
			'=<name> – Reusable function from settings (e.g. =1, =2;5)',
		hint_date:
			'%<date/time> – Date or time (e.g. %now, %today, %2026-01-01, %14:00)',
		hint_ip_default:
			':ip[:<step>] – IPv4 sequence with default IP from settings (e.g. :ip:1)',
		hint_devops_specify_len: '{0}:<length> – Specify length (e.g. {0}:16)',
		hint_doc_order:
			'$ – Document order enabled (insert from top to bottom)',
		hint_reverse_order: '! – Reverse order enabled (insert backwards)',

		// Parameter Semantics Validation Errors
		err_invalid_frequency:
			'Invalid frequency "{0}": expected positive integer > 0 (e.g. *2)',
		err_invalid_repetition:
			'Invalid repetition "{0}": expected positive integer > 0 (e.g. #5)',
		err_invalid_startover:
			'Invalid startover "{0}": expected positive integer > 0 (e.g. ##10)',
		err_invalid_random_range:
			'Invalid random range: "{0}" is not a valid upper bound (e.g. 1r10)',
		err_invalid_alpha_option:
			'Invalid letter option "?{0}": allowed are ?u (Upper), ?l (Lower), ?p (PascalCase)',
		err_invalid_date_step:
			'Invalid date step size "{0}": expected e.g. :1d, :2w, :1m, :1y, :1h, :15min',
		err_invalid_ip_step:
			'Invalid IPv4 step size "{0}": expected an integer (e.g. :1, :-1)',
		err_invalid_alpha_step:
			'Invalid step size "{0}": expected an integer for letters (e.g. :1, :2, :-1)',
		err_invalid_numeric_step:
			'Invalid step size "{0}": expected a number (e.g. :2, :-1, :0.5)',
	},
	de: {
		// General / Syntax
		err_syntax_or_eval: 'Syntax- oder Auswertungsfehler',
		err_unclosed_backtick:
			'Nicht geschlossenes Backtick-Template (fehlendes ` am Ende)',
		err_unmatched_brace: 'Nicht übereinstimmende "}" im Backtick-Template',
		err_unclosed_brace: 'Nicht geschlossene "{" im Template-Platzhalter',
		err_unclosed_quote:
			'Nicht geschlossenes Anführungszeichen im Template',
		info_template_placeholder:
			'Template-String sollte "{}" als Platzhalter für die Sequenz enthalten',
		info_enter_standalone_expr:
			'JavaScript-Ausdruck eingeben (z. B. |"item_" + (i+1))',
		err_invalid_expression: 'Ungültiger Ausdruck: {0}',
		info_enter_inline_expr:
			'JavaScript-Ausdruck nach "::" eingeben (z. B. ::"row_" + _)',
		err_invalid_inline_expr: 'Ungültiger Ausdruck (::): {0}',
		info_enter_stop_expr:
			'Stop-Bedingung nach "@" eingeben (z. B. @i>=10)',
		err_invalid_stop_expr: 'Ungültige Stop-Bedingung (@): {0}',
		info_enter_hex_digits: 'Hexadezimalziffern eingeben (0-9, a-f)',
		err_invalid_hex:
			'Ungültige Hexadezimalzahl: "{0}" enthält ungültige Zeichen',
		info_enter_bin_digits: 'Binärziffern eingeben (0 oder 1)',
		err_invalid_bin:
			'Ungültige Binärzahl: "{0}" enthält nicht-binäre Zeichen',
		info_enter_oct_digits: 'Oktalziffern eingeben (0-7)',
		err_invalid_oct:
			'Ungültige Oktalzahl: "{0}" enthält nicht-oktale Zeichen',
		err_invalid_ip_octet:
			'Ungültige IPv4-Adresse: Oktett überschreitet 255 ({0} gefunden)',
		err_invalid_ip_cidr:
			'Ungültiges IPv4-CIDR-Präfix /{0} (muss 0-32 sein)',
		err_invalid_time:
			'Ungültige Uhrzeit "{0}": Stunden müssen 0-23 und Minuten/Sekunden 0-59 sein',
		err_invalid_date: 'Ungültiges Datum "{0}": {1}',
		err_unknown_uuid:
			'Unbekannte UUID-Version "{0}": Es werden nur v4 und v7 unterstützt',
		err_invalid_token_len:
			'Ungültige Länge "{0}": Positive Zahl erwartet',

		// Trailing / Contextual Operator Hints
		hint_startover:
			'##<startover> – Neustart: Sequenz alle N Werte neu starten (z. B. ##10)',
		hint_repeat:
			'#<repeat> – Repetition / Zyklus: Sequenz nach N Werten wiederholen (z. B. #5)',
		hint_frequency:
			'*<frequency> – Frequenz: jeden Wert N-mal wiederholen (z. B. *2)',
		hint_format:
			'~<format> – Formatierung (z. B. ~03d für Padding, ~>10 für Ausrichtung, ~hex, ~bin, ~roman)',
		hint_casing:
			'?<option> – Casing / Option (?u = GROSS, ?l = klein, ?p = PascalCase)',
		hint_delim: '_<delim> – Benutzerdefiniertes Trennzeichen (z. B. _, oder _-)',
		hint_random_range:
			'r<max> – Zufallsbereich: Obergrenze angeben (z. B. 1r10 = Zufallszahlen zwischen 1 und 10)',
		hint_step_or_devops:
			':<step> (Schrittweite) oder Spezialsequenz (:uuid, :rnd:<Länge>, :pwd:<Länge>, :ip)',
		hint_rnd_len:
			':rnd:<Länge> – Alphanumerischer Zufallstoken (z. B. :rnd:16)',
		hint_pwd_len:
			':pwd:<Länge> – Sicheres Zufallspasswort (z. B. :pwd:16)',
		hint_hex_len:
			':hex:<Länge> – Hexadezimaler Hash/Token (z. B. :hex:32)',
		hint_token_len:
			':token:<Länge> – URL-sicherer Token (z. B. :token:24)',
		hint_uuid:
			':uuid[:<version>] – UUID-Generator (Standard v4, oder :uuid:v7)',
		hint_ip_step: ':<step> – IPv4-Schrittweite (z. B. :1, :-1)',
		hint_date_step:
			':<step> – Datumsschrittweite (z. B. :1d, :2w, :1m, :1y, :1h, :15min)',
		hint_step: ':<step> – Schrittweite (z. B. :2, :-1)',
		hint_step_keyword: 'step:<step> – Schrittweite (z. B. step:2, step:-1)',
		hint_list:
			';<name> – Vordefinierte Liste aus Einstellungen (z. B. ;Jan, ;?1)',
		hint_function:
			'=<name> – Reusable Function aus Einstellungen (z. B. =1, =2;5)',
		hint_date:
			'%<date/time> – Datum oder Uhrzeit (z. B. %now, %today, %2026-01-01, %14:00)',
		hint_ip_default:
			':ip[:<step>] – IPv4-Sequenz mit Default-IP aus Einstellungen (z. B. :ip:1)',
		hint_devops_specify_len: '{0}:<Länge> – Länge angeben (z. B. {0}:16)',
		hint_doc_order:
			'$ – Dokument-Reihenfolge aktiviert (von oben nach unten einfügen)',
		hint_reverse_order: '! – Reihenfolge umkehren aktiviert (invers einfügen)',

		// Parameter Semantics Validation Errors
		err_invalid_frequency:
			'Ungültige Frequenz "{0}": Erwartet eine positive Ganzzahl > 0 (z. B. *2)',
		err_invalid_repetition:
			'Ungültige Repetition "{0}": Erwartet eine positive Ganzzahl > 0 (z. B. #5)',
		err_invalid_startover:
			'Ungültiger Neustart (startover) "{0}": Erwartet eine positive Ganzzahl > 0 (z. B. ##10)',
		err_invalid_random_range:
			'Ungültiger Zufallsbereich: "{0}" ist keine gültige Obergrenze (z. B. 1r10)',
		err_invalid_alpha_option:
			'Ungültige Buchstaben-Option "?{0}": Erlaubt sind ?u (Groß), ?l (Klein), ?p (PascalCase)',
		err_invalid_date_step:
			'Ungültige Datumsschrittweite "{0}": Erwartet z. B. :1d, :2w, :1m, :1y, :1h, :15min',
		err_invalid_ip_step:
			'Ungültige IPv4-Schrittweite "{0}": Erwartet eine Ganzzahl (z. B. :1, :-1)',
		err_invalid_alpha_step:
			'Ungültige Schrittweite "{0}": Erwartet eine Ganzzahl für Buchstaben (z. B. :1, :2, :-1)',
		err_invalid_numeric_step:
			'Ungültige Schrittweite "{0}": Erwartet eine Zahl (z. B. :2, :-1, :0.5)',
	},
} as const;

export type TranslationKey = keyof typeof translations.en;

/**
 * Resolves the target language in prioritized order:
 * 1. Explicit configuration setting `insertseq.language` (e.g. 'de', 'en')
 * 2. VS Code environment language (`vscode.env.language`)
 * 3. Default fallback to 'en'
 */
export function getLanguage(parameter?: TParameter): Language {
	try {
		const configured = parameter?.config
			?.get<string>('language')
			?.trim()
			.toLowerCase();
		if (configured) {
			if (configured.startsWith('de')) {
				return 'de';
			}
			if (configured.startsWith('en')) {
				return 'en';
			}
		}

		const envLang = vscode?.env?.language?.toLowerCase() || '';
		if (envLang.startsWith('de')) {
			return 'de';
		}
	} catch {
		// Fallback to English in case of missing context
	}

	return 'en';
}

/**
 * Translates a given key with positional placeholder replacement ({0}, {1}, ...).
 */
export function t(
	key: TranslationKey,
	parameter?: TParameter,
	...args: (string | number)[]
): string {
	const lang = getLanguage(parameter);
	const dict = translations[lang] || translations.en;
	let message: string =
		(dict as Record<string, string>)[key] || translations.en[key] || key;

	if (args.length > 0) {
		for (let i = 0; i < args.length; i++) {
			message = message.replace(
				new RegExp(`\\{${i}\\}`, 'g'),
				String(args[i]),
			);
		}
	}

	return message;
}

