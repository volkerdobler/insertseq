import { RuleTemplate } from './types';

// Get regular expressions for segmenting the input string
export function getRegExpressions(): RuleTemplate {
	const matchRule: RuleTemplate = {
		start_decimal: '', // start Wert bei Zahlen
		start_alpha: '', // Start-Wert bei Buchstaben
		start_date: '', // Start-Wert bei Datumseingabe
		start_own: '', // Start-Wert bei eigenen Listen (string)
		start_predefined: '', // Start-Wert in der Configuration vordefinierte Listen (string)
		start_expression: '', // Start-Wert bei Ausdrücken
		start_function: '', // Start-Wert bei Funktionen
		steps_decimal: '', // Schritte bei Zahlen (auch mit Nachkommastellen möglich)
		steps_date: '', // Schritte bei einem Datum (es wird d, w, m oder y nach einer Zahl geschrieben, um zu sagen, welche Einheit die Steps sind)
		steps_other: '', // Schritte bei anderen Typen (nur Ganzzahl-Schritte)
		format_decimal: '', // Formatierung der Zahlen
		format_alpha: '',
		format_date: '',
		language: '',
		repetition: '',
		frequency: '',
		startover: '', // startet von vorne, unabhängig von repetition und frequency
		expression: '',
		stopexpression: '',
		outputSort: '',
		outputReverse: '',
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
	ruleTemplate.charStartExpr = `^\\s*(?:\\||expr(?:ession)?:)`;
	ruleTemplate.charStartFunction = `^\\s*(?:=|func(?:tion)?:)`;
	// rules, which are normally not at the beginning of an input (but could be, when <start> is omitted/defaulted)
	ruleTemplate.charStartSteps = `(?:(?<!^)\\bsteps?:|(?<!:|format|freq|frequency|func|function|rep|repeat|repetition|startat|startagain|startover|expr|expression|stop|stopexpr|stopexpression|option|options):)`;
	ruleTemplate.charStartFormat = `(?:(?<!^)\\bformat:|~)`;
	ruleTemplate.charStartFrequency = `(?:(?<!^)\\bfreq(?:uency)?:|(?:(?<!\\*)\\*))`;
	ruleTemplate.charStartRepetition = `(?:(?<!^)\\brep(?:eat|etition)?:|(?<!#)#)`;
	ruleTemplate.charStartStartover = `(?:(?<!^)\\bstart(?:again|over):|##)`;
	ruleTemplate.charStartExpression = `(?:(?<!^)\\bexpr(?:ession)?:|::)`;
	ruleTemplate.charStartStopExpression = `(?:(?<!^)\\bstop(?:expr(?:ession)?|if)?:|@)`;
	// optional information after charStartOptions
	ruleTemplate.charStartOptions = `(?:(?<!^)\\bopt(?:ion(?:s)?)?:|\\?)`;
	ruleTemplate.specialchars = `(?:[_epasni])`;
	ruleTemplate.dateunits = `(?:[dDwWmMyY])`;
	ruleTemplate.predefinedoptions = `(?: [ifsIFS]+ )`;
	ruleTemplate.alphacapitalchars = `(?: [uUlLpP]? )`;
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
										_
										(?<seqdelimiter> .{1,2})
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
									(?<start> [\\w]+ )
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
										(?<datepart>
											(?<year> \\d{2}|\\d{4} )
											(?:
												(?:-
													(?<month> 0?[1-9]|10|11|12 )
												)
												(?:-
													(?<day> 0?[1-9]|[12][0-9]|30|31 )
												)?
											)?
										)
										|
										(?<fulldate>
											{{doublestring}}
											| {{singlestring}}
											| {{brackets}}
											| .+?
										)
										(?![\\d-])
									)?
									(?: {{sequencedelimiter}} )?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.start_expression = `^(?:
										(?:{{charStartExpr}})
										\\s*
										(?<start>
											{{doublestring}}
											| {{singlestring}}
											| {{brackets}}
											| {{easyexpression}}
										)
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
									| \\w+
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
										(?= {{delimiter}} )
									)`;
	ruleTemplate.steps_decimal = `(?:(?<!{{charStartSteps}})(?:{{charStartSteps}}) \\s* (?<steps> {{signedNum}}) (?= {{delimiter}} ))`;
	ruleTemplate.steps_date = `(?:
									(?<!{{charStartSteps}})
									(?:{{charStartSteps}})
									(?<steps> {{signedNum}})?
									\\s*
									(?<date_unit> {{dateunits}} )?
									(?= {{delimiter}} )
								)`;
	ruleTemplate.steps_other = `(?:(?<!{{charStartSteps}})(?:{{charStartSteps}}) \\s* (?<steps> {{signedInt}}) (?= {{delimiter}} ))`;
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
										(?<type> [bcdeEfFgGnoxX%] )?
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
	ruleTemplate.frequency = `(?:(?<!{{charStartFrequency}})(?:{{charStartFrequency}}) \\s* (?<freq> \\d+) (?= {{delimiter}} ))`;
	ruleTemplate.repetition = `(?:(?<!{{charStartRepetition}})(?: {{charStartRepetition}}) \\s* (?<repeat> \\d+ ) (?= {{delimiter}} ))`;
	ruleTemplate.startover = `(?:(?:{{charStartStartover}}) \\s* (?<startover> \\d+) (?= {{delimiter}} ))`;
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
	ruleTemplate.outputSort = `\\$!? $`;
	ruleTemplate.outputReverse = `!\\$? $`;

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
