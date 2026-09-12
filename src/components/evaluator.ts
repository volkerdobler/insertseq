import { RuleTemplate } from '../types';

/**
 * Build and return the full set of compiled regex-segment strings used to
 * parse the user's input string.
 *
 * The function works in two passes:
 * 1. A `ruleTemplate` dictionary is built where entries may reference each
 *    other via `{{key}}` placeholders.
 * 2. All placeholders are resolved recursively and the final strings are
 *    copied — with whitespace stripped — into the returned `matchRule`
 *    dictionary (only keys that exist in `matchRule` are exported).
 *
 * Whitespace inside the template strings is purely for readability; it is
 * removed before the strings are used as regex source.
 *
 * @returns A {@link RuleTemplate} map whose values are ready-to-use regex
 *   source strings (without flags).
 */
export function getRegExpressions(): RuleTemplate {
	const matchRule: RuleTemplate = {
		start_decimal: '', // start Wert bei Zahlen
		start_alpha: '', // Start-Wert bei Buchstaben
		start_date: '', // Start-Wert bei Datumseingabe
		start_own: '', // Start-Wert bei eigenen Listen (string)
		start_predefined: '', // Start-Wert in der Configuration vordefinierte Listen (string)
		start_expression: '', // Start-Wert bei Ausdrücken
		start_function: '', // Start-Wert bei Funktionen
		start_uuid: '',
		start_randomToken: '',
		start_ip: '',
		steps_decimal: '', // Schritte bei Zahlen (auch mit Nachkommastellen möglich)
		steps_date: '', // Schritte bei einem Datum (es wird d, w, m oder y nach einer Zahl geschrieben, um zu sagen, welche Einheit die Steps sind)
		steps_other: '', // Schritte bei anderen Typen (nur Ganzzahl-Schritte)
		format_decimal: '', // Formatierung der Zahlen
		format_alpha: '',
		format_date: '',
		format_ip: '',
		language: '',
		repetition: '',
		frequency: '',
		startover: '', // startet von vorne, unabhängig von repetition und frequency
		expression: '',
		stopexpression: '',
		outputSort: '',
		outputReverse: '',
		charStartAlpha: '',
		charStartDate: '',
		charStartOwnSequence: '',
		charStartPredefinedSequence: '',
		charStartExpressionfunction: '',
		charStartFunction: '',
		charStartSteps: '',
		charStartFormat: '',
		charStartFrequency: '',
		charStartRepetition: '',
		charStartStartover: '',
		charStartExpression: '',
		charStartStopExpression: '',
		charStartOptions: '',
		charStartUuid: '',
		charStartRandomToken: '',
		charStartIp: '',
		easyexpression: '',
	};

	// String-Eingabe: (?:"(?:(?:(?<!\\\\)\\\\")|[^"])+")
	// String-Eingabe: (?:\'(?:(?:(?<!\\\\)\\\\\')|[^\'])+\')
	// Klammer-Eingabe: (?:\\((?:(?:(?<!\\\\)\\\\\\))|[^)])+\\))

	// Special Chars in Expressions:
	// _ ::= current value (before expression or value under current selection)
	// s ::= value of <step>
	// n ::= number of selections
	// p ::= previous value se(last inserted)
	// c ::= current value (only within expressions, includes value after expression)
	// a ::= value of <start>
	// i ::= counter, starting with 0 and increasing with each insertion
	const ruleTemplate: RuleTemplate = {};
	// start of input, which defines input types
	ruleTemplate.charStartDate = `^\\s*(?:%|date:)`;
	ruleTemplate.charStartOwnSequence = `^\\s*(?:\\[|(?:own(?:seq(?:uence)?)?:))`;
	ruleTemplate.charStartPredefinedSequence = `^\\s*(?:;|predef(?:ined)?(?:seq(?:uence)?)?:)`;
	ruleTemplate.charStartExpressionfunction = `^\\s*(?:\\||expr(?:ession)?:)`;
	ruleTemplate.charStartFunction = `^\\s*(?:=|func(?:tion)?:)`;
	ruleTemplate.charStartUuid = `^\\s*(?::uuid)`;
	ruleTemplate.charStartRandomToken = `^\\s*(?::(?:rnd|random|hex|pwd|password|token|hash)|(?:rnd|hex|pwd|password|token|hash):)`;
	ruleTemplate.ipv4Octet = `(?:25[0-5]|2[0-4]\\d|1\\d\\d|0?\\d?\\d)`;
	ruleTemplate.ipv4Address = `(?:{{ipv4Octet}}\\.{{ipv4Octet}}\\.{{ipv4Octet}}\\.{{ipv4Octet}}(?!\\d))`;
	ruleTemplate.charStartIp = `^\\s*(?::(?:ip|ipv4)|(?:ip|ipv4):|{{ipv4Address}})`;
	ruleTemplate.charStartAlpha = `^(^\\s*(?:(?:alpha(?:bet)?|string):)?)`;
	// rules, which are normally not at the beginning of an input (but could be, when <start> is omitted/defaulted)
	ruleTemplate.charStartSteps = `(?:\\bsteps?:|(?<!:|format|freq|frequency|func|function|rep|repeat|repetition|startat|startagain|startover|expr|expression|stop|stopexpr|stopexpression|option|options|delimiter):)`;
	ruleTemplate.charStartFormat = `(?:\\bformat:|~)`;
	ruleTemplate.charStartFrequency = `(?:\\bfreq(?:uency)?:|(?:(?<!\\*)\\*))`;
	ruleTemplate.charStartRepetition = `(?:\\brep(?:eat|etition)?:|(?<!#)#)`;
	ruleTemplate.charStartStartover = `(?:\\bstart(?:again|over):|##)`;
	ruleTemplate.charStartExpression = `(?:\\bexpr(?:ession)?:|::)`;
	ruleTemplate.charStartStopExpression = `(?:\\bstop(?:expr(?:ession)?|if)?:|@)`;
	// optional information after charStartOptions
	ruleTemplate.charStartOptions = `(?:\\bopt(?:ion(?:s)?)?:|\\?)`;
	// sub-rules
	ruleTemplate.myDelimiterOption = `(?:\\bdelimiter:|_)`;
	ruleTemplate.specialchars = `(?:[_epasni])`;
	ruleTemplate.dateunits = `(?:minute|minutes|second|seconds|hour|hours|day|days|week|weeks|month|months|year|years|min|sec|ms|[dDwWmMyYhHsS])`;
	ruleTemplate.predefinedoptions = `(?: [ifsIFS]+ )`;
	ruleTemplate.alphacapitalchars = `(?: [uUlLpP]? )`;
	ruleTemplate.myDelimiterChars = `(?: [\\s_xo<>-] )`;
	// all Rules including sub-rules
	ruleTemplate.doublestring = `(?:"
									(?<indoublequotes>
										(?:
											(?:
												(?<!\\\\) \\\\"
											)
											|[^"]
										)+
									)
									"
								)`;
	ruleTemplate.singlestring = `(?:\'
									(?<insinglequotes>
										(?:
											(?:
												(?<!\\\\)\\\\\'
											)
											|[^\']
										)+
									)
									\'
								)`;
	ruleTemplate.brackets = `(?:\\(
								(?<inbrackets>
									(?:
										(?:
											(?<!\\\\)\\\\\\)
										)
										|[^)]
									)+
								)
								\\)
							)`;
	ruleTemplate.leadchars = `[0x\\s\\._]`;
	ruleTemplate.delimiterTokens = `(?: \\s | {{charStartSteps}} | {{charStartFormat}} | {{charStartRepetition}} | {{charStartFrequency}} | {{charStartOwnSequence}} | {{charStartExpression}} | {{charStartStopExpression}} | \\$ | !)`;
	ruleTemplate.delimiter = `(?:\\s*(?:(?= {{delimiterTokens}} ) | $) )`;
	ruleTemplate.sequencedelimiter = `(?:
										\\s*
										{{myDelimiterOption}}
										(?<seqdelimiter> (?:{{myDelimiterChars}}{1,}|.)?)
									)`;
	ruleTemplate.integer = `(?:[1-9]\\d*|0)`;
	ruleTemplate.pointfloat1 = `(?: (?: [1-9]\\d*|0 )? \\. (?<startDecimals1> \\d+ ) )`;
	ruleTemplate.pointfloat2 = `(?: (?: [1-9]\\d*|0 )? \\. (?<startDecimals2> \\d+ ) )`;
	ruleTemplate.pointfloatForExpression = `(?: (?: [1-9]\\d*|0 )? \\. \\d+ )`;
	ruleTemplate.exponentfloat = `(?:(?:{{integer}} | {{pointfloat2}}) [e] [+-]? \\d+)`;
	ruleTemplate.float = `(?:{{pointfloat1}} | {{exponentfloat}})`;
	ruleTemplate.hexNum = `(?:0[x](?<hex>0|[1-9a-f][0-9a-f]*))`;
	ruleTemplate.octNum = `(?:0[o](?<oct>0|[1-7][0-7]*))`;
	ruleTemplate.binNum = `(?:0[b](?<bin>[01]+))`;
	ruleTemplate.numeric = `(?:(?<int>{{integer}}) | (?<float>{{float}}))`;
	ruleTemplate.exprtoken = `(?:
								\\s*\\b
								(?:
									(?: [+-]?
										(?: {{integer}} | {{pointfloatForExpression}} )
									)
									| {{specialchars}}
								)
								\\b\\s*
							)`;
	ruleTemplate.exproperator = `(?: \\s* (?:\\+|-|\\*|\\/|\\*\\*|mod|div) \\s* )`;
	ruleTemplate.exprcompare = `(?:<=|<|>=|>|===|==)`;
	ruleTemplate.easyexpression = `(?:
									{{exprtoken}}
									(?:
										{{exproperator}}
										{{exprtoken}}
									)*
									(?:
										{{exprcompare}}
										{{exprtoken}}
										(?:
											{{exproperator}}
											{{exprtoken}}
										)*
									)
								)`;
	ruleTemplate.random = `(?:
								(?:
									(?<rndAvailable> [rR])
									\\s*
									(?:
										(?<rndPlusMinus> [+-])?
										(?<rndNumber> \\d+
											(?:
												\\.
												(?<rndDecimals> \\d+)
											)?
										)
									)?
								)
							)`;
	ruleTemplate.language = `(?:
								lang:
								(?<language> \\w{2,3}
									(?: -\\w{2,3})?
								)
							)`;
	ruleTemplate.signedInt = `(?<int>[+-]? {{integer}})`;
	ruleTemplate.signedNum = `(?:[+-]? (?:{{numeric}} | {{hexNum}} | {{octNum}} | {{binNum}}))`;
	ruleTemplate.start_decimal = `^(?:
									(?<lead_string>
										(?<lead_char> {{leadchars}})
										\\k<lead_char>*
									)?
									(?<start>
										(?:{{signedNum}})
									)
									(?: {{random}} )?
									(?: {{sequencedelimiter}} )?
									(?:
										{{charStartOptions}}
										(?<radixPrefix> [01] )?
									)?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.start_alpha = `^(?:
									(?: {{charStartAlpha}} )
									\\s*
									(?<start> [\\u0]+ )
									(?:
										{{charStartOptions}}
										(?<alphacapital> {{alphacapitalchars}} )
									)?
									(?: {{sequencedelimiter}} )?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.start_date = `^(?:
									(?: {{charStartDate}} )
									\\s*
									(?<start>
										(?<now> now )
										|
										(?<datetimepart>
											(?<year> \\d{4}|\\d{2} ) - (?<month> 0?[1-9]|10|11|12 ) (?: - (?<day> 0?[1-9]|[12][0-9]|30|31 ) )?
											(?: [ T] (?<timepart> \\d{1,2} : \\d{2} (?: : \\d{2} )? ) )?
										)
										|
										(?<timeonly>
											\\d{1,2} : \\d{2} (?: : \\d{2} )?
										)
										|
										(?<datepart>
											(?<year_only> \\d{4} ) (?: - (?<month_only> 0?[1-9]|10|11|12 ) (?: - (?<day_only> 0?[1-9]|[12][0-9]|30|31 ) )? )?
										)
										|
										(?<fulldate>
											{{doublestring}}
											| {{singlestring}}
											| {{brackets}}
											| .+?
										)
									)?
									(?: {{sequencedelimiter}} )?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.start_expression = `^(?:
										(?:{{charStartExpressionfunction}})
										\\s*
										(?<start>
											{{doublestring}}
											| {{singlestring}}
											| {{brackets}}
											| {{easyexpression}}
										)
										(?: {{sequencedelimiter}} )?
										(?= {{delimiter}} )
									)`;
	ruleTemplate.start_own = `^(?:
								\\[
								(?<ownseq>
									(?:
										(?:
											(?<!\\\\)
											\\\\\\]
										)
										|
										[^\\]]
									)*
								)
								\\]
								\\s*
								(?:
									(?: start(?:seq(?:uence)?)?: )?
									(?<startseq>
										\\d+
									)
								)?
								(?: {{sequencedelimiter}} )?
								(?= {{delimiter}} )
							)`;
	ruleTemplate.start_predefined = `^(?:
								( {{charStartPredefinedSequence}} )
								\\s*
								(?<start_predefined>
									{{doublestring}}
									| {{singlestring}}
									| \\S+
								)?
								(?:
									{{charStartOptions}}
									\\s*
									(?<predefinedopts>
										(?:
											(?:
												\\d+
												(?:
													\\|
													(?: \\d+)?
												)?
											)
											\\s*
											{{predefinedoptions}}
										)
										|
										(?:
											{{predefinedoptions}}
											\\s*
											(?:
												\\d+
												(?:
													\\|
													(?: \\d+)?
												)?
											)
										)
										|
										(?:
											{{predefinedoptions}}
										)
										|
										(?:
											\\d+
												(?:
													\\|
													(?: \\d+)?
												)?
										)
									)?
								)?
								(?: {{sequencedelimiter}} )?
								(?= {{delimiter}} )
							)`;
	ruleTemplate.start_function = `^(?:
										{{charStartFunction}}
										(?<funcNr> \\d+ )
										(?: \\s* ;
											\\s* (?<funcStartAt> \\d+ )
										)?
										(?: {{sequencedelimiter}} )?
										(?= {{delimiter}} )
									)`;
	ruleTemplate.steps_decimal = `(?:(?<!{{charStartSteps}})(?:{{charStartSteps}}) \\s* (?<steps> {{signedNum}}) (?= {{delimiter}} ))`;
	ruleTemplate.steps_date = `(?:
									(?<!{{charStartSteps}})
									(?:{{charStartSteps}})
									(?<step_expr>
										(?:
											[+-]? \\d+(?:\\.\\d+)? \\s* {{dateunits}} \\s*
										)+
										|
										(?<steps> {{signedNum}} )? \\s* (?<date_unit> {{dateunits}} )?
									)
									(?= {{delimiter}} )
								)`;
	ruleTemplate.steps_other = `(?:(?<!{{charStartSteps}})(?:{{charStartSteps}}) \\s* (?<steps> {{signedInt}}) (?= {{delimiter}} ))`;
	ruleTemplate.repetition = `(?:(?<!{{charStartRepetition}})(?: {{charStartRepetition}}) \\s* (?<repeat> \\d+ ) (?= {{delimiter}} ))`;
	ruleTemplate.frequency = `(?:(?<!{{charStartFrequency}})(?:{{charStartFrequency}}) \\s* (?<freq> \\d+) (?= {{delimiter}} ))`;
	ruleTemplate.startover = `(?:(?:{{charStartStartover}}) \\s* (?<startover> \\d+) (?= {{delimiter}} ))`;
	ruleTemplate.format_decimal = `(?:
									{{charStartFormat}}
									(?<format_decimal>
										(?<padding> {{leadchars}} )?
										(?<align> [<>^=] )?
										(?<sign> [ +-] )?
										(?<alternate> # )?
										(?<length>
											(?<zero> 0 )?
											(?: \\d+ )
										)?
										(?<thousands> , )?
										(?<precision>\\.\\d+ )?
										(?<type> roman | ROMAN | [bcdeEfFgGnoxX%rR] )?
									)
									(?= {{delimiter}} )
								)`;
	ruleTemplate.format_alpha = `(?:
									{{charStartFormat}}
									(?<format_alpha>
										(?<padding> {{leadchars}} )?
										(?<align> [<>^=] )?
										(?<length> \\d+ )?
										(?<wrap> w )?
										(?<leftright> [lLrR] )?
									)
									(?= {{delimiter}} )
								)`;
	ruleTemplate.format_date = `(?:
									{{charStartFormat}}
									(?:
										(?: {{language}} )
										\\s*
									)?
									(?<dateformat>
										{{doublestring}}
										| {{singlestring}}
										| {{brackets}}
										| [^\\s]+
									)?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.format_ip = `(?:
									{{charStartFormat}}
									(?<format_ip>
										{{doublestring}}
										| {{singlestring}}
										| {{brackets}}
										| [^\\s:]+
									)
									(?= {{delimiter}} )
								)`;
	ruleTemplate.expression = `(?: {{charStartExpression}} \\s*
								(?<expr>
									{{doublestring}}
									| {{singlestring}}
									| {{brackets}}
									| {{easyexpression}}
								)
								(?= {{delimiter}} )
							)`;
	ruleTemplate.stopexpression = `(?: {{charStartStopExpression}} \\s*
									(?<stopexpr>
										{{doublestring}}
										| {{singlestring}}
										| {{brackets}}
										| {{easyexpression}}
									)
									(?= {{delimiter}} )
								)`;
	ruleTemplate.outputSort = `(?:\\$!|!\\$|\\$)\\s*$`;
	ruleTemplate.outputReverse = `(?:\\$!|!\\$|!)\\s*$`;

	ruleTemplate.start_uuid = `^(?:
									(?: {{charStartUuid}} )
									(?:
										\\s*
										:?
										\\s*
										(?<uuidversion> [vV]?[47] )
									)?
									(?:
										\\s*
										(?: {{charStartFormat}} | {{charStartOptions}} )
										\\s*
										(?<uuidformat> [a-zA-Z]+ )
									)?
									(?: {{sequencedelimiter}} )?
									(?= {{delimiter}} )
								)`;

	ruleTemplate.start_randomToken = `^(?:
										(?<tokenType>
											:(?:rnd|random|hex|pwd|password|token|hash)
											|
											(?:rnd|hex|pwd|password|token|hash):
										)
										(?:
											:?
											(?<tokenLength> \\d+ )
										)?
										(?:
											{{charStartOptions}}
											(?<tokenOptions> [a-zA-Z0-9_-]+ )
										)?
										(?: {{sequencedelimiter}} )?
										(?= {{delimiter}} )
									)`;

	ruleTemplate.start_ip = `^\\s*(?:
									(?<ipPrefix>
										:(?:ip|ipv4)(?::(?={{ipv4Address}}))?
										|
										(?:ip|ipv4):
									)?
									\\s*
									(?<start>
										(?<ipAddress> {{ipv4Address}} )
										(?<cidr> /\\d{1,2} )?
									)?
									(?: {{sequencedelimiter}} )?
									(?= {{delimiter}} )
								)`;

	for (let [key, value] of Object.entries(ruleTemplate)) {
		while (value.indexOf('{{') > -1) {
			const start: number = value.indexOf('{{');
			const ende: number = value.indexOf('}}', start + 2) + 2;
			const replace: string = value.slice(start, ende);
			const rule: string = replace.slice(2, replace.length - 2);
			if (rule in ruleTemplate) {
				value = value.replace(replace, ruleTemplate[rule]);
			} else {
				value = value.replace(replace, '§NIX§');
			}
		}
		if (key in matchRule) {
			matchRule[key] = value.replace(/\s/gi, '');
		}
	}

	return matchRule;
}
