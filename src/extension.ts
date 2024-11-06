/*
The extension "InsertSeq" (previous InsertNums) is an adoption of a wonderful plugin for sublimecode from James Brooks.
https://github.com/jbrooksuk/InsertNums

All errors are in my own responsibility and are solely done by
myself.

If you want to contact me, send an E-Mail to
insertseq.extension@dobler-online.com

Volker Dobler
original from May 2020
rewritten February 2023
 */

const debug = false;

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// don't update this module!!! Starting with version 3, it will currently not work anymore!
import * as d3 from 'd3-format';
import * as datefns from 'date-fns';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  if (debug) {
    console.log('Congratulations, your extension "insertseq" is now active!');
  }
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const insertSeq = vscode.commands.registerCommand(
    'extension.insertSeq',
    (value: string = '') => {
      InsertSequenceCommand({ context, value, version: 'insertseq' });
    },
  );

  // const insertNums = vscode.commands.registerCommand(
  //   'extension.insertNums',
  //   (value: string = '') => {
  //     // Display a message box to the user
  //     vscode.window.showInformationMessage(
  //       'The command has changed to insertSeq. insertNums is depreciated but currently still possible. Please change your keymap (CTRL-K CTRL-K)',
  //     );

  //     InsertSequenceCommand({ context, value, version: 'insertnums' });
  //   },
  // );

  context.subscriptions.push(insertSeq);
  // context.subscriptions.push(insertNums);

  const showSeqHistoryCommand = vscode.commands.registerCommand(
    'extension.insertSeq.showHistory',
    () => {
      insertSequenceHistory({ context });
    },
  );

  // const showNumHistoryCommand = vscode.commands.registerCommand(
  //   'extension.insertNums.showHistory',
  //   () => {
  //     vscode.window.showInformationMessage(
  //       'The command has changed to insertSeq.showHistory. insertNums.showHistory is depreciated but currently still possible. Please change your keymap (CTRL-K CTRL-K)',
  //     );

  //     insertSequenceHistory({ context, version: 'insertnums' });
  //   },
  // );

  context.subscriptions.push(showSeqHistoryCommand);
  // context.subscriptions.push(showNumHistoryCommand);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  return;
}

const appName: string = 'insertseq';

function InsertSequenceCommand({
  context,
  value,
  version,
}: {
  context: vscode.ExtensionContext;
  value: string;
  version?: string;
}): void {
  type valueType = {
    value: string;
  };

  function addHistory({ value }: valueType) {
    let histories: string[] = context.globalState.get('histories', []);

    const itemIndex: number = histories.indexOf(value);
    if (itemIndex !== -1) {
      histories.splice(itemIndex, 1);
    }
    histories.unshift(value);

    const historyLimit: number | undefined =
      vscode.workspace.getConfiguration(appName).get('historyLimit') ||
      vscode.workspace.getConfiguration('insertnums').get('historyLimit') ||
      0;
    if (historyLimit && historyLimit !== 0 && histories.length > historyLimit) {
      histories.splice(historyLimit - 1, histories.length); // Remove excess records
    }

    context.globalState.update('histories', histories);
  }

  function numToAlpha(num: number, len = 0): string {
    let res = '';
    while (num > 0) {
      --num;
      res = String.fromCharCode(97 + (num % 26)) + res;
      num = Math.floor(num / 26);
    }

    if (res.length > len) {
      res = res.slice(-len);
    }
    return res;
  }

  function alphaToNum(alpha: string): number {
    let res = 0;

    alpha = alpha.toLocaleLowerCase();

    for (let i = 0; i < alpha.length; i++) {
      res *= 26;
      res += alpha.charCodeAt(i) - 96;
    }

    return res;
  }

  function monthToNum(month: string, lang: string): number {
    if (Number.isInteger(+month)) return -1;

    for (let i = 1; i <= 12; i++) {
      if (
        getMonth(
          i,
          'l',
          lang,
          Math.max(month.length, 1),
        ).toLocaleUpperCase() === month.toLocaleUpperCase()
      ) {
        return i;
      }
      if (
        getMonth(
          i,
          's',
          lang,
          Math.max(month.length, 1),
        ).toLocaleUpperCase() === month.toLocaleUpperCase()
      ) {
        return i;
      }
    }

    return -1;
  }

  function numToMonth(m: number, form?: 's' | 'l', lang?: string): string {
    m = ((m - 1) % 12) + 1;
    if (m >= 1 && m <= 12) {
      let f: 's' | 'l' = form || (config_defaultLangFormat as 's' | 'l');
      let l = lang || config_defaultLang;

      return getMonth(m, f, l);
    } else {
      return '';
    }
  }

  function numToHex(num: number, len: number = 0): string {
    let res = '';

    while (num > 0) {
      const divRest = num % 16;
      if (divRest >= 10) {
        res = String.fromCharCode(87 + divRest) + res;
      } else {
        res = String.fromCharCode(48 + divRest) + res;
      }
      num = Math.floor(num / 16);
    }

    while (res.length < len) {
      res = '0' + res;
    }

    return '0x' + res;
  }

  function isHex(hex: string): boolean {
    return hex.substring(0, 2).toLocaleLowerCase() === '0x';
  }

  function hexToNum(hex: string): number {
    let res = 0;

    for (let i = 2; i < hex.length; i++) {
      res *= 16;
      const curCharCode = hex.toLocaleLowerCase().charCodeAt(i);

      switch (true) {
        case curCharCode >= 48 && curCharCode <= 57:
          res += curCharCode - 48;
          break;
        case curCharCode >= 97 && curCharCode <= 102:
          res += curCharCode - 87;
          break;
        default:
          curWindow.showErrorMessage('Wrong hex number: ${hey}');
      }
    }

    return res;
  }

  function formatString(
    format: { fill: string; align: string; length: number; adjust: boolean },
    text: string,
  ): string {
    let str: string = text;

    while (str.length < format.length) {
      if (format.align === '<') {
        str += format.fill;
      }
      if (format.align === '>') {
        str = format.fill + str;
      }
      if (format.align === '^') {
        if (str.length % 2 === 0) {
          str = format.fill + str + format.fill;
        } else {
          str = format.adjust ? str + format.fill : format.fill + str;
        }
      }
    }

    return format.length === 0
      ? text
      : // : str.substring(str.length > format.length ? 1 : 0);
        str.substring(0, format.length);
  }

  function getRandomNumber(from: number, to: number): number {
    return Math.round(Math.random() * (to - from) + from);
  }

  if (!Object.entries) {
    Object.entries = function (obj: any): any {
      const ownProps = Object.keys(obj);
      let i = ownProps.length;
      const resArray = new Array(i); // preallocate the Array
      while (i--) {
        resArray[i] = [ownProps[i], obj[ownProps[i]]];
      }
      return resArray;
    };
  }

  function getMonth(
    idx: number,
    format: 's' | 'l',
    country?: string,
    finish?: number,
  ): string {
    let objDate = new Date();

    let end: number = finish || Number.MAX_SAFE_INTEGER;

    objDate.setDate(1);
    objDate.setMonth(idx - 1);

    let f: 'short' | 'long' = 'short';
    if (format === 'l') {
      f = 'long';
    }

    let locale =
      country ||
      vscode.workspace.getConfiguration(appName).get('defaultlang') ||
      config_defaultLang;

    let output = objDate.toLocaleString(locale, { month: f });

    return output.slice(0, end);
  }

  function getValidInputRegExp(): { [key: string]: any } {
    type RuleTemplate = {
      [key: string]: string;
    };

    function hasKey(obj: RuleTemplate, key: string): boolean {
      return key in obj;
    }

    const ruleTemplate: RuleTemplate = {
      integer: '[1-9]\\d* | 0',
      hexdigits: '[1-9a-fA-F][0-9a-fA-F]*',
      signedint: '[+-]? {{integer}}',
      pointfloat: '({{integer}})? \\. \\d+ | {{integer}} \\.',
      exponentfloat: '(?:{{integer}} | {{pointfloat}}) [eE] [+-]? \\d+',
      float: '{{pointfloat}} | {{exponentfloat}}',
      hexNum: '0[xX]{{hexdigits}}',
      numeric: '{{integer}} | {{float}}',
      signedNum: '([+-]? {{numeric}})|{{hexNum}}',
      startNum:
        '((?<numSign1>[+-])? (?<lead_char1> 0+|\\s+|\\.+|_+)? {{numeric}})|((?<lead_char2> 0+|\\s+|\\.+|_+)? (?<numSign2>[+-])? {{numeric}})|{{hexNum}}',
      format:
        '((?<format_padding> [^}}])? (?<format_align> [<>^=]))? (?<format_sign> [-+ ])? #? (?<format_filled> 0)? (?<format_integer> {{integer}})? (\\.(?<format_precision> \\d+))? (?<format_type> [bcdeEfFgGnoxX%])?',
      alphastart: '[a-z]+ | [A-Z]+',
      alphaformat:
        '((?<alphaformat_padding>[^}}])? (?<alphaformat_align>[<>^])(?<alphaformat_correct> [lr])?)? ((?<alphaformat_integer>{{integer}}))?',
      dateformat:
        '(?:G{1,5}|y{1,5}|R{1,5}|u{1,5}|Q{1,5}|q{1,5}|M{1,5}|L{1,5}|w{1,2}|l{1,2}|d{1,2}|E{1,6}|i{1,5}|e{1,6}|c{1,6}|a{1,5}|b{1,5}|B{1,5}|h{1,2}|H{1,2}|k{1,2}|K{1,2}|m{1,2}|s{1,2}|S{1,4}|X{1,5}|x{1,5}|O{1,4}|z{1,4}|t{1,2}|T{1,2}|P{1,4}|p{1,4}|yo|qo|Qo|Mo|lo|Lo|wo|do|io|eo|co|ho|Ho|Ko|ko|mo|so|Pp|PPpp|PPPppp|PPPPpppp|.)*',
      monthtxt: '[\\p{L}\\p{M}]+|\\d{1,2}',
      monthformat: '(?:l(ong)?|s(hort)?)\\b',
      year: '(?:\\d{1,4})',
      month: '(?:12|11|10|0?[1-9])',
      day: '(?:3[012]|[12]\\d|0?[1-9])',
      date: '(?<date> (?<year> {{year}}?)(?:(?<datedelimiter>[-.])(?<month>{{month}})(?:\\k<datedelimiter>(?<day>{{day}}))?)?)?',
      datestep: '(?:(?<datestepunit>[dwmy])(?<datestepvalue>{{signedint}}))?',
      cast: '[ifsbm]',
      expr: '.+?',
      stopExpr: '.+?',
      exprMode:
        '^(?<cast> {{cast}})?\\|(~(?:(?<monthformat> {{monthformat}})|(?<format> {{format}}))::)? (?<expr> {{expr}}) (@(?<stopExpr> {{stopExpr}}))? (?<sort_selections> \\$)? (\\[(?<lang> [\\w-]+)\\])? (?<reverse> !)?$',
      insertNum:
        '^(?<start> {{startNum}})? (:(?<step> {{signedNum}}))? (r(?<random> \\+?[1-9]\\d*))? (\\*(?<frequency> {{integer}}))? (#(?<repeat> {{integer}}))? (~(?<format> {{format}}))? (::(?<expr> {{expr}}))? (@(?<stopExpr> {{stopExpr}}))? (?<sort_selections> \\$)? (?<reverse> !)?$',
      insertAlpha:
        '^(?<start> {{alphastart}}) (:(?<step> {{signedint}}))? (\\*(?<frequency> {{integer}}))? (#(?<repeat> {{integer}}))? (~(?<format> {{alphaformat}})(?<wrap> w)?)? (@(?<stopExpr> {{stopExpr}}))? (?<sort_selections> \\$)? (?<reverse> !)?$',
      insertMonth:
        '^(;(?<start> {{monthtxt}}))(:(?<step> {{signedint}}))? (\\*(?<frequency> {{integer}}))? (#(?<repeat> {{integer}}))? (~(?<monthformat> {{monthformat}}))? (@(?<stopExpr> {{stopExpr}}))? (\\[(?<lang> [\\w-]+)\\])? (?<sort_selections> \\$)? (?<reverse> !)?$',
      insertDate:
        '^(%(?<start> {{date}}|{{integer}})) (:(?<step> {{datestep}}))? (\\*(?<frequency> {{integer}}))? (#(?<repeat> {{integer}}))? (~(?<dateformat> {{dateformat}}))? (?<sort_selections> \\$)? (?<reverse> !)?$',
    };

    // TODO - linesplit einfügen (?:\\|(?<line_split>[^\\|]+)\\|)?
    const result: RuleTemplate = {
      exprMode: '',
      insertNum: '',
      insertAlpha: '',
      insertMonth: '',
      insertDate: '',
    };

    for (let [key, value] of Object.entries(ruleTemplate)) {
      while (value.indexOf('{{') > -1) {
        const start: number = value.indexOf('{{');
        const ende: number = value.indexOf('}}', start + 2) + 2;
        const replace: string = value.slice(start, ende);
        const rule: string = replace.slice(2, replace.length - 2);
        if (hasKey(ruleTemplate, rule)) {
          value = value.replace(replace, ruleTemplate[rule]); // works fine!
        }
      }
      if (hasKey(result, key)) {
        result[key] = value.replace(/\s/gi, '');
      }
    }

    return { result };
  }

  // check if vscode is available (should be ;-) )
  const curWindow = vscode?.window;
  if (!curWindow) {
    return;
  }

  // check if TextEditor is available/open
  const curTextEditor = curWindow.activeTextEditor;
  if (!curTextEditor) {
    curWindow.showErrorMessage(
      `[${appName}] Extension only available with an active Texteditor`,
    );
    return;
  }

  // check if selection is available (should be ;-) )
  const selections = curTextEditor.selections;
  if (!selections) {
    curWindow.showErrorMessage(
      `[${appName}] No selection available! Is Texteditor active?`,
    );
    return;
  }

  // default values (can be change via configuration)
  // where to start
  const defaultStart: string = '1';
  // what steps are default
  const defaultStep: string = '1';
  // what type of insertation? (string)
  const defaultCast: string = 's';
  // when a string is centered, but is not perfectly possible, move one character to the left (true) or right (false) - e.g. true => | a  |; false => |  a |
  const defaultCenterString: string = 'l';
  // default Language for months
  const defaultLang: string = 'de';
  // default Language Format (short - 3 chars) for months
  const defaultLangFormat: string = 's';
  // default insertOrder (either: cursor, firstLast, lastFirst)
  const defaultInsertOrder: string = 'cursor';
  // default century, if year is only with 1 or 2 digits
  const defaultCentury: string = '20';
  // default dateStep (1 day)
  const defaultDateStepUnit: string = 'd';
  // default date format
  const defaultDateFormat: string = 'dd.MM.yyyy';

  // how many selections do we have?
  const selLen = selections.length;

  // read configuration
  const config_editHistory: boolean =
    vscode.workspace.getConfiguration(appName).get('editHistory') ||
    vscode.workspace.getConfiguration('insertnums').get('editHistory') ||
    false;

  const config_start: string =
    vscode.workspace.getConfiguration(appName).get('start') ||
    vscode.workspace.getConfiguration('insertnums').get('start') ||
    defaultStart;

  const config_step: string =
    vscode.workspace.getConfiguration(appName).get('step') ||
    vscode.workspace.getConfiguration('insertnums').get('step') ||
    defaultStep;

  const config_cast: string =
    vscode.workspace.getConfiguration(appName).get('cast') ||
    vscode.workspace.getConfiguration('insertnums').get('cast') ||
    defaultCast;

  const config_centerString: string =
    vscode.workspace.getConfiguration(appName).get('centerString') ||
    vscode.workspace.getConfiguration('insertnums').get('centerString') ||
    defaultCenterString;

  const config_defaultLang: string =
    vscode.workspace.getConfiguration(appName).get('language') ||
    vscode.workspace.getConfiguration('insertnums').get('language') ||
    defaultLang;

  const config_defaultLangFormat: string =
    vscode.workspace.getConfiguration(appName).get('languageFormat') ||
    vscode.workspace.getConfiguration('insertnums').get('languageFormat') ||
    defaultLangFormat;

  const config_defaultInsertOrder: string =
    vscode.workspace.getConfiguration(appName).get('insertOrder') ||
    vscode.workspace.getConfiguration('insertnums').get('insertOrder') ||
    defaultInsertOrder;

  const config_defaultCentury: string =
    vscode.workspace.getConfiguration(appName).get('century') ||
    vscode.workspace.getConfiguration('insertnums').get('century') ||
    defaultCentury;

  const config_defaultDateStepUnit: string =
    vscode.workspace.getConfiguration(appName).get('dateStepUnit') ||
    vscode.workspace.getConfiguration('insertnums').get('dateStepUnit') ||
    defaultDateStepUnit;

  const config_defaultDateFormat: string =
    vscode.workspace.getConfiguration(appName).get('dateFormat') ||
    vscode.workspace.getConfiguration('insertnums').get('dateFormat') ||
    defaultDateFormat;

  // Direct start of command is without value, so the inputbox is shown.
  if (value.length === 0 || config_editHistory) {
    curWindow
      .showInputBox({
        prompt:
          'Syntax: [<start>][:<step>][#<repeat>][*<frequency>][~<format>]r[+]<random>][::<expr>][@<stopexpr>][$][!]',
        // prompt: `Enter format string (default: '${config_start}:${config_step}')`,
        value: value,
        // placeHolder: `${config_start}:${config_step}`,
        placeHolder: `${config_start}:${config_step}`,
        // '[<start>][:<step>][#<repeat>][*<frequency>][~<format>]r[+]<random>][::<expr>][@<stopexpr>][$][!]',
      })
      .then((value) => {
        if (value === '') {
          value = `${config_start}:${config_step}`;
        }
        if (value) {
          renderResult({ result: value });
        }
      });
  } else {
    // called from History with a value
    renderResult({ result: value });
  }

  // the working horse
  function renderResult({ result }: { result: string }): void {
    // historic history functionality (string starts with !)
    if (result.length > 1 && result[0] === '!') {
      let rest = result.substring(1);
      // get saved history of last commands
      let histories = context.globalState.get('histories', []);
      switch (rest) {
        // get previous command
        case '!':
          if (histories.length > 0) {
            result = histories[0];
          } else {
            curWindow.showErrorMessage('[History] No previous command');
            return;
          }
          break;
        // show all previous commands in a Pick-Input
        case 'p':
          if (histories.length > 0) {
            vscode.commands.executeCommand('extension.insertSeq.showHistory');
          } else {
            curWindow.showErrorMessage('[History] Empty');
          }
          return;
        // clear history
        case 'c':
          context.globalState.update('histories', []);
          curWindow.showErrorMessage('[History] Cleared!');
          return;
        default:
          let numRest = Math.abs(parseInt(rest));
          let nachNum = rest.replace(String(numRest), '');
          if (histories.length >= numRest) {
            result = histories[numRest] + (nachNum.length > 0 ? nachNum : '');
            if (nachNum.length > 0) {
              addHistory({ value: result });
            }
          }
      }
    } else {
      addHistory({ value: result });
    }

    const eingabe =
      result.length > 0 ? result : `${config_start}:${config_step}`;

    // get the valid input regexps for numbers, alpha and substitution mode
    const regResult = getValidInputRegExp();

    let matchNum: RegExpExecArray | null = null;
    let matchAlpha: RegExpExecArray | null = null;
    let matchExpr: RegExpExecArray | null = null;
    let matchMonth: RegExpExecArray | null = null;
    let matchDate: RegExpExecArray | null = null;

    matchNum = new RegExp(regResult.result.insertNum).exec(eingabe);
    matchAlpha = new RegExp(regResult.result.insertAlpha, 'u').exec(eingabe);
    matchExpr = new RegExp(regResult.result.exprMode).exec(eingabe);
    matchMonth = new RegExp(regResult.result.insertMonth, 'iu').exec(eingabe);
    matchDate = new RegExp(regResult.result.insertDate, 'iu').exec(eingabe);

    let groups = matchNum?.groups ||
      matchAlpha?.groups ||
      matchExpr?.groups ||
      matchMonth?.groups ||
      matchDate?.groups || { start: config_start, step: config_step };

    if (!matchNum && !matchAlpha && !matchExpr && !matchMonth && !matchDate) {
      let errorMsg =
        `[${appName}] No valid regular expression: >` + eingabe + '<. ';
      errorMsg += `DEFAULT: ${config_start}:${config_step} `;
      errorMsg +=
        'Options: NUMBERS:  [<start>][:<step>][~<format>][r+?<to>]][*<frequency>][#repetitions][::<expr>][@<stopexpr>][$][!] or ';
      errorMsg +=
        'ALPHA:  <a-z+|A-Z+> [:<step>][~<format>][*<frequency>][#repetitions][@<stopexpr>][w][$][!] or ';
      (errorMsg +=
        '<year>[-<month>[-<day>]] [:<datestep>] [~<dateformat>] [*<frequency>][#repetitions][$][!]'),
        (errorMsg +=
          'SUBSTITUTION: [<cast>]|[~<format>::]<expr>[@<stopexpr>][$][!] or ');
      errorMsg +=
        'MONTH:  ;<monthname>|<monthnumber> [:<step>][~<format>][*<frequency>][#repetitions][@<stopexpr>][[<lang>]][$][!] or ';
      errorMsg +=
        '(deprecated) HISTORY: !(!|pd+|c|d+ with !! = prev. command, !c = clear history ';
      curWindow.showErrorMessage(errorMsg);
      return;
    }

    // language settings (for months sequences)
    const LANG = groups?.lang || config_defaultLang;
    // check if substitution
    const EXPRMODE = !!matchExpr;
    // check if month
    const MONTH =
      !!matchMonth &&
      ((Number.isNaN(+groups?.start) && monthToNum(groups?.start, LANG) > 0) ||
        (+groups?.start > 0 && +groups?.start <= 12));
    // check if alpha (not allowed with month!)
    const ALPHA = !!matchAlpha || MONTH;
    // check if date is inserted
    const DATE = !!matchDate;

    // if groups.year is undefined, a "normal" integer was detected. Now let's see,
    // if it is a 4-digit number (probably a year) or a two-digit (a short year)
    // or anything else.
    if (!groups?.year) {
      switch (true) {
        case groups?.start.length === 4:
          groups.year = groups.start;
          break;
        case groups?.start.length === 2:
          groups.year = config_defaultCentury + groups.start;
          break;
        default:
          groups.year = String(new Date().getFullYear() + +groups.start);
      }
    }

    // if year is only 1 digit, add 0 to have at least 2 digits (excl. century)
    if (groups?.year?.length === 1) {
      groups.year = '0' + groups.year;
    }

    const currYear = DATE
      ? groups?.year?.length <= 2
        ? config_defaultCentury + groups.year
        : groups.year
      : new Date().getFullYear();

    const currMonth: string =
      DATE && groups?.month ? groups.month : String(new Date().getMonth() + 1);

    const currDay: string =
      DATE && groups?.day ? groups.day : String(new Date().getDate());

    // look for currDateStepUnit which makes sense
    groups.datestepunit ||= config_defaultDateStepUnit;

    switch (true) {
      case groups.datestepunit === 'd' || groups.datestepunit === 'w':
        if (groups?.day) break;

        groups.datestepunit = 'm';
        if (groups?.month) break;

        groups.datestepunit = 'y';
        break;
      case groups.datestepunit === 'm':
        if (groups?.month) break;

        groups.datestepunit = 'y';
        break;
    }

    const currDateStepUnit: string = groups.datestepunit;

    const currDateStepValue: number = Number(groups?.datestepvalue)
      ? Number(groups.datestepvalue)
      : Number(config_step);

    // check if reverse is on
    const REVERSE = groups.reverse === '!';

    // check, if selections/multilines needs to be sorted before insertation
    const SORTSEL =
      (groups.sort_selections === '$' &&
        config_defaultInsertOrder === 'cursor') ||
      (groups.sort_selections != '$' && config_defaultInsertOrder === 'sorted');
    // Long or Short format for months
    const LANGFORMAT: 's' | 'l' =
      (groups?.monthformat && groups?.monthformat[0] === 'l') ||
      config_defaultLangFormat === 'l'
        ? 'l'
        : 's';

    groups.start ||= config_start;

    // do we have a leading Character for formatting?
    const leadingChar = groups.lead_char1 || groups.lead_char2 || null;
    const availableLeadingChar = groups.numSign1 || groups.numSign2 || null;
    const signBeforeLeadingChar = !!groups.numSign1;
    const startLength = leadingChar
      ? availableLeadingChar === '-'
        ? groups.start.length - 1
        : groups.start.length
      : 0;

    if (leadingChar) {
      groups.start = groups.start.replace(leadingChar, '');
    }

    // start value (also re-start for frequency)
    const start = isHex(groups.start)
      ? hexToNum(groups.start).toString()
      : groups.start;

    const startDate = new Date(
      Number(currYear),
      Number(currMonth) - 1,
      Number(currDay),
      0,
      0,
      0,
    );

    const startValue = !DATE
      ? parseFloat(start)
      : datefns.getUnixTime(startDate);
    if (!ALPHA && !MONTH && Number.isNaN(startValue)) {
      curWindow.showErrorMessage(`${start} is not a valid start number]!`);
      return;
    }

    groups.step ||= config_step;
    // the incrementation
    const step = isHex(groups.step)
      ? hexToNum(groups.step).toString()
      : groups.step;

    // convert all values later to hex number, because we found a hex in the input
    const ISHEXMODE = groups.start
      ? isHex(groups.start)
      : false || groups.step
        ? isHex(groups.step)
        : false || false;
    // check, if random number is used
    const ISRANDOM = groups.random != undefined;
    // upper bound of random number range
    const randomTo =
      groups.random && groups.random[0] === '+'
        ? startValue + (parseFloat(groups.random) || 0)
        : parseFloat(groups.random) || 0;
    // how often should each "insertation" be repeated
    const repeatValue =
      groups.repeat && parseInt(groups.repeat) > 0
        ? parseInt(groups.repeat)
        : Number.MAX_SAFE_INTEGER;
    // what is the max. number of insertation, before starting from beginning?
    const frequencyValue =
      groups.frequency && parseInt(groups.frequency) > 0
        ? parseInt(groups.frequency)
        : 1;
    // is there any "expression" in the input
    const expr = !ALPHA && groups.expr;
    // when to stop the insertation?
    const stopExpr = groups.stopExpr || '';
    // when replacing anything, what cast (typenumber) should be used
    const cast = EXPRMODE && groups.cast ? groups.cast : config_cast;
    // does the alpha input starts with a uppercase letter?
    const UPPER =
      (!MONTH && ALPHA && start && start[0] === start[0].toUpperCase()) ||
      (MONTH && Number.isNaN(+start) && start.toLocaleUpperCase() === start) ||
      false;
    // wrap alpha input
    const WRAP = ALPHA && groups.wrap === 'w';
    // which format should be used
    const format =
      groups.format ||
      (leadingChar ? leadingChar[0] + '>' + startLength : null);

    const dateformat = groups?.dateformat || config_defaultDateFormat;

    // which split char should be used?
    const linesplit: string = groups?.line_split
      ? groups?.line_split
      : curTextEditor?.document.eol === 1
        ? '\n'
        : '\r\n';

    // string formatting
    const alphaFormat = {
      fill:
        groups.alphaformat_padding && groups.alphaformat_padding.length === 1
          ? groups.alphaformat_padding
          : ' ',
      align:
        groups.alphaformat_align && groups.alphaformat_align.match(/^[<>^]$/)
          ? groups.alphaformat_align
          : '<',
      length: parseInt(groups.alphaformat_integer) || 0,
      // default: TRUE (l) => | a  |; FALSE (r) => |  a |
      adjust: groups.alphaformat_correct
        ? groups.alphaformat_correct === 'l'
        : config_centerString === 'l',
    };

    // check if RandomTo larger than RandomFrom (startValue) - if not, stop
    if (randomTo > 0 && randomTo <= startValue) {
      curWindow.showErrorMessage(
        `[Random sequence]: From ${startValue} is larger then To: ${randomTo}]!`,
      );
      return;
    }

    // all insertations/replacements
    const values: string[] = [];

    const sortSelections: vscode.Selection[] = SORTSEL
      ? quicksort({ arr: selections, low: 0, high: selections.length - 1 })
      : selections.slice();

    // stores prev value for expression calculation (of next value)
    let prevValue: number = 0;

    const castTable: { [key: string]: Function } = {
      i: function (value: string): string {
        return value.length > 0 ? parseInt(value).toString() : '0';
      },
      f: function (value: string): string {
        return value.length > 0 ? parseFloat(value).toString() : '0';
      },
      s: function (value: string): string {
        return value;
      },
      b: function (value: string): string {
        return Boolean(value).toString();
      },
      m: function (value: string): string {
        return monthToNum(value, LANGFORMAT) > -1
          ? monthToNum(value, LANGFORMAT).toString()
          : numToMonth(+value, LANGFORMAT, LANG);
      },
    };

    const WSPedit = new vscode.WorkspaceEdit();

    // curIteration as number
    let curIterationVal = 0;

    // current new value as string
    let curValueStr: string = value.toString();

    // max. time in the infinit loop (while-loop below)
    const startTime = Date.now();
    const timeLimit = 1000; // max. 1 second in the while loop

    // to end end-less loop (beside time limit of 1 second)
    let loopContinue = true;
    // rest of selection in expression mode should be replaced with ''
    let removeRestOfSubstitution = false;

    while (loopContinue) {
      // no stop expression available and we already have reached the final selection/cursor position => break
      if (stopExpr.length === 0 && selections.length <= curIterationVal) {
        loopContinue = false;
        break;
      }
      if (!debug && Date.now() > startTime + timeLimit) {
        curWindow.showInformationMessage(
          `Time limit of ${timeLimit}ms exceeded`,
        );
        return;
      }

      let curIterationIndex =
        Math.trunc(curIterationVal / frequencyValue) % repeatValue;

      let selectedText: string = '';
      if (curIterationVal < sortSelections.length) {
        const rangeSel = !REVERSE
          ? sortSelections[curIterationVal]
          : sortSelections[sortSelections.length - 1 - curIterationVal];

        selectedText =
          cast.length === 1
            ? castTable[cast] &&
              castTable[cast](curTextEditor?.document.getText(rangeSel))
            : parseInt(curTextEditor?.document.getText(rangeSel) || '') || '';
      }

      let exprValueStr: string = '';

      // if expression is available, calculate the expression
      if (expr) {
        // unserscoreValue depends on mode: expremode => selected text as number; else => (start + i * step)
        let underscoreValue = EXPRMODE
          ? monthToNum(selectedText, LANG) > -1
            ? monthToNum(selectedText, LANG)
            : selectedText
          : startValue + curIterationIndex * parseFloat(step);

        // tmp Variables, replace internal variables in the expression
        let tmpString = expr
          .replace(/\b_\b/g, underscoreValue.toString())
          .replace(/\bs\b/gi, step.toString())
          .replace(/\bn\b/gi, selLen.toString())
          .replace(/\bp\b/gi, prevValue.toString())
          .replace(/\ba\b/gi, startValue.toString())
          .replace(/\bi\b/gi, curIterationVal.toString());
        try {
          let evalResult = eval(tmpString);
          if (
            monthToNum(selectedText, LANG) > -1 &&
            Number.isInteger(evalResult)
          ) {
            exprValueStr = numToMonth(evalResult, LANGFORMAT, LANG);
          } else {
            exprValueStr = evalResult.toString();
          }
        } catch (e) {
          curWindow.showErrorMessage(
            `[${expr}] Invalid Expression. Exception is: ` + e,
          );
          return;
        }
      }

      // if stop expression is available, calculate it
      if (stopExpr) {
        // calculate the current value
        let underscoreValue = startValue + curIterationIndex * parseFloat(step);

        let tmpString = stopExpr
          .replace(/\b_\b/g, underscoreValue.toString())
          .replace(/\bs\b/gi, step.toString())
          .replace(/\bn\b/gi, selLen.toString())
          .replace(/\bp\b/gi, prevValue.toString())
          .replace(/\bc\b/gi, exprValueStr.toString())
          .replace(/\ba\b/gi, startValue.toString())
          .replace(/\bi\b/gi, curIterationVal.toString());
        try {
          let stopResult = eval(tmpString);
          if (stopResult) {
            loopContinue = false;
            break;
          }
          if (stopResult === '') {
            removeRestOfSubstitution = true;
            loopContinue = false;
            break;
          }
        } catch (e) {
          curWindow.showErrorMessage(
            `[${stopExpr}] Invalid Stop Expression. Exception is: ` + e,
          );
          return;
        }
      }

      let curValueStr: string = '';
      let curValueIsNumber: boolean = false;

      let value: number;

      // get curValue as string
      switch (true) {
        case ALPHA:
          // alpha mode

          if (MONTH) {
            if (Number.isNaN(+start)) {
              value =
                monthToNum(start, LANG) + curIterationIndex * parseInt(step);
            } else {
              value = parseInt(start) + curIterationIndex * parseInt(step);
            }
            curValueStr = numToMonth(value, LANGFORMAT, LANG);
          } else {
            value = alphaToNum(start) + curIterationIndex * parseInt(step);
            curValueStr = numToAlpha(value, WRAP ? 1 : 0);
          }

          if (UPPER) {
            curValueStr = curValueStr.toLocaleUpperCase();
          }
          curValueIsNumber = false;
          break;
        case DATE:
          let datestr: Date;

          switch (currDateStepUnit) {
            case 'd':
              datestr = datefns.addDays(
                startDate,
                curIterationIndex * Number(currDateStepValue),
              );
              break;
            case 'w':
              datestr = datefns.addWeeks(
                startDate,
                curIterationIndex * Number(currDateStepValue),
              );
              break;
            case 'm':
              datestr = datefns.addMonths(
                startDate,
                curIterationIndex * Number(currDateStepValue),
              );
              break;
            case 'y':
              datestr = datefns.addYears(
                startDate,
                curIterationIndex * Number(currDateStepValue),
              );
              break;
            default:
              datestr = datefns.addDays(
                startDate,
                curIterationIndex * Number(currDateStepValue),
              );
              break;
          }

          value = datefns.getUnixTime(datestr);
          curValueStr = datefns.format(datestr, dateformat);

          break;
        default:
          // numeric mode or substitution mode

          // if expression is available, calculat value based on expression result
          if (exprValueStr.length > 0) {
            curValueStr = exprValueStr;
            curValueIsNumber = Number.isFinite(+exprValueStr);
          } else {
            // if random option is choosen, value is a random number
            if (ISRANDOM) {
              value = getRandomNumber(startValue, randomTo);
            } else {
              value = startValue + curIterationIndex * parseFloat(step);
            }

            curValueIsNumber = true;
            if (EXPRMODE) {
              if (cast === 's') {
                curValueStr = selectedText + value.toString();
                curValueIsNumber = false;
              } else {
                value += parseFloat(selectedText) || 0;
                curValueStr = value.toString();
              }
            } else {
              curValueStr = value.toString();
              curValueIsNumber = Number.isFinite(+curValueStr);
            }
          }
      }

      // get current value as previous value for next expression
      prevValue = parseFloat(curValueStr) || parseFloat(exprValueStr) || 0;

      // format string available format curValueStr
      if (format) {
        // if the curValueStr is a number, use d3.format
        if (curValueIsNumber) {
          if (+curValueStr < 0 && signBeforeLeadingChar) {
            curValueStr =
              availableLeadingChar +
              d3.format(format)(+curValueStr.substring(1));
          } else {
            curValueStr = d3.format(format)(+curValueStr);
          }
        } else {
          curValueStr = formatString(alphaFormat, curValueStr);
        }
      }

      if (ISHEXMODE && Number.isFinite(+curValueStr)) {
        curValueStr = numToHex(+curValueStr);
      }
      // new output to the stack
      values.push(curValueStr.toString());

      // iteration number for expression replacement
      curIterationVal += 1;
    }

    if (curTextEditor) {
      if (REVERSE) {
        sortSelections.reverse();
      }
      if (EXPRMODE) {
        // substitution mode
        let curPosition: vscode.Selection = sortSelections[0];
        // replace all selections
        sortSelections.forEach(function (
          element: vscode.Selection,
          index: number,
        ) {
          if (index < values.length) {
            WSPedit.replace(
              curTextEditor.document.uri,
              new vscode.Range(element.start, element.end),
              values[index],
            );
          } else {
            if (removeRestOfSubstitution) {
              WSPedit.replace(
                curTextEditor.document.uri,
                new vscode.Range(element.start, element.end),
                '',
              );
            }
          }
          curPosition = element;
        });
      } else {
        // insert mode (numberic or alpha)
        let curPosition: vscode.Position = sortSelections[0].active;
        let selectionCounter: number = 0;
        let restStr: string = '';
        values.forEach(function (element: string, index: number) {
          // as long as we have another selection, replace this selection
          if (sortSelections && sortSelections[index]) {
            curPosition = sortSelections[index].active;
            if (index + 1 < sortSelections.length || !REVERSE) {
              WSPedit.replace(
                curTextEditor.document.uri,
                new vscode.Range(
                  sortSelections[index].start,
                  sortSelections[index].end,
                ),
                element,
              );
            } else {
              restStr = element;
            }
            selectionCounter++;
          } else {
            // we don't have any addition selection left -
            // collect all other elements with the newline character
            if (!REVERSE) {
              restStr += element + (index < values.length ? linesplit : '');
            } else {
              restStr = element + linesplit + restStr;
            }
          }
        });
        // if the selection is more than the insertation, add empty strings
        for (let i = selectionCounter; i < sortSelections.length; i++) {
          WSPedit.replace(
            curTextEditor.document.uri,
            new vscode.Range(sortSelections[i].start, sortSelections[i].end),
            '',
          );
        }
        // if we have to insert additional elements,
        // insert them now ...
        if (restStr.length > 0) {
          // we are not at the last line,
          // write the additional elements to the next line
          if (curPosition.line + 1 < curTextEditor.document.lineCount) {
            curPosition = new vscode.Position(
              REVERSE ? curPosition.line : curPosition.line + 1,
              curPosition.character,
            );
          } else {
            // we are at the last line, so we need to include an linesplit first,
            // then insert the rest
            restStr = REVERSE ? restStr + linesplit : linesplit + restStr;
          }
          WSPedit.insert(curTextEditor.document.uri, curPosition, restStr);
        }
      }
      vscode.workspace.applyEdit(WSPedit);
    }
  }
}

function insertSequenceHistory({
  context,
  version,
}: {
  context: vscode.ExtensionContext;
  version?: string;
}) {
  interface QuickPickItem extends vscode.QuickPickItem {
    commandParam: string;
  }

  const histories: QuickPickItem[] = context.globalState
    .get('histories', [])
    .map((item, index) => {
      return {
        label: `[${index + 1}] ${item}`,
        commandParam: `${item}`,
      };
    });

  const newItem: QuickPickItem = {
    label: '[0] new item',
    commandParam: '',
  };
  histories.unshift(newItem);

  const options = {
    placeHolder:
      histories.length > 0
        ? 'InsertSeq History:'
        : 'InsertSeq History: [Empty]',
    onDidSelectItem: (selection: QuickPickItem | string) => {
      let x = 1;
      let y = selection;
    },
  };

  // check if vscode is available (should be ;-) )
  const curWindow = vscode?.window;
  if (!curWindow) {
    return;
  }

  if (histories.length > 0) {
    curWindow.showQuickPick(histories, options).then((item) => {
      vscode.commands.executeCommand(
        'extension.insertSeq',
        item ? item.commandParam : '',
      );
    });
  }
}

function quicksort({
  arr,
  low,
  high,
}: {
  arr: readonly vscode.Selection[];
  low: number;
  high: number;
}): vscode.Selection[] {
  function compare(a: vscode.Selection, b: vscode.Selection): number {
    return a.anchor.line === b.anchor.line
      ? a.anchor.character - b.anchor.character
      : a.anchor.line - b.anchor.line;
  }

  let arrreturn: vscode.Selection[] = arr.slice(); // Object.assign([], arr);
  if (arrreturn.length <= 1) return arrreturn;

  let pivot: vscode.Selection = arrreturn[Math.floor((low + high) / 2)];
  let left: vscode.Selection[] = [];
  let right: vscode.Selection[] = [];
  for (let i = low; i <= high; i++) {
    let cmp = compare(arrreturn[i], pivot);
    if (cmp > 0) {
      right.push(arrreturn[i]);
    }
    if (cmp < 0) {
      left.push(arrreturn[i]);
    }
  }
  return [
    ...quicksort({ arr: left, low: 0, high: left.length - 1 }),
    pivot,
    ...quicksort({ arr: right, low: 0, high: right.length - 1 }),
  ];
}
