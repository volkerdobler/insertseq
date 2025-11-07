"use strict";
/*
The idea of the extension "InsertSeq" (previous InsertNums) based on the plugin insertnums
for sublimecode from James Brooks
Version 1.0 is completely rewritten and additional features are added.

Original sublimecode extension: https://github.com/jbrooksuk/InsertNums
Version 1.0 has some inspirations from the extension "VSCodeExtensionInsertSequence" (https://github.com/kuone314/VSCodeExtensionInsertSequence) by kuone314

Volker Dobler
original from May 2020
rewritten November 2025
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// external modules
const vscode = require("vscode");
const temporal_polyfill_1 = require("temporal-polyfill");
// internal modules
const history_1 = require("./history");
const formatting = require("./formatting");
const safeEval_1 = require("./safeEval");
// internal console.log command, if debug is true
const debug = false;
function printToConsole(str) {
    if (debug)
        console.log('Debugging: ' + str);
}
// this method is called when your extension is activated
function activate(context) {
    // register insertseq command (normal insertion)
    context.subscriptions.push(vscode.commands.registerCommand('extension.insertseq', (value) => {
        InsertSeqCommand(context, value);
        printToConsole('Congratulations, extension "insertseq" is now active!');
    }));
    // register insertseq.history command (insertion from history / previous insertions)
    context.subscriptions.push(vscode.commands.registerCommand('extension.insertseq.history', (value) => {
        InsertSeqHistory(context, value);
        printToConsole('Congratulations, extension "insertseq.history" is now active!');
    }));
}
function deactivate() { }
const appName = 'insertseq';
// Default configuration values (will be overwritten by user settings)
let previewDecorationType = null;
// current shown history quickpick (if any) - used by delete/clear commands
let currentHistoryQuickPick = null;
// sort function: sort and/or reverse selections. If neither sort nor reverse is set, returns the original array.
function sortSelectionsByPosition(selections, sort = false, reverse = false) {
    const tempSelections = sort
        ? selections.slice().sort((a, b) => {
            if (a.start.line === b.start.line) {
                return a.start.character - b.start.character;
            }
            return a.start.line - b.start.line;
        })
        : selections;
    return reverse ? tempSelections.slice().reverse() : tempSelections;
}
// Syntaxes for different input types:
// ===================================
// decimals: [<start>[r[+]<random>][?<delimiter>]][:<step>][#<repeat>][*<frequency>][##startover][~<format>][::<expr>][@<stopexpr>][$][!]
// alpha: <start>[:<step>][#<repeat>][*<frequency>][##startover][~<format>][::<expr>][@<stopexpr>][w][$][!]
// dates: %[<year>[-<month>[-<day>]]][:<step>[dwmy]][#<repeat>][*<frequency>][##startover][~<format>][$][!]
// expressions: |<expr>[~<format>][@<stopexpr>][$][!]
// own (war "months"): ;<start>[:<step>][#<repeat>][\*<frequency>][##startover][~<format>][@<stopexpr>][$][!]
// predefined: <predefinedList as array>[?[whicharray[|startat]][ifs]][:<step>][#<repeat>][\*<frequency>][##startover][~<format>][@<stopexpr>][$][!]
// initialize global parameters, get original selections, regex segments and configuration (used in insertNewSequence and insertSeqHistory)
async function initApp(editor) {
    // read config file, since version 1.0 insertnums config entries are no longer merged
    const config = Object.assign({}, vscode.workspace.getConfiguration(appName));
    // read regular Expression for segmenting the input string
    const regexpInputSegments = getRegExpressions();
    // get current selected Text
    const origTextSelections = editor.selections.map((selection) => editor.document.getText(selection));
    // delete current selected Text (will be inserted later when input is cancelled). Wait for edit to finish because of the following cursor position reading.
    await editor.edit((builder) => {
        editor.selections.forEach((selection) => {
            builder.replace(selection, '');
        });
    });
    // get current (multi-)cursor positions (without original selected Text)
    const origCursorPositions = editor.selections.map((selection) => new vscode.Selection(selection.start, selection.start));
    // global parameter for sequence creation which will be passed to subfunctions
    return {
        editor: editor,
        origCursorPos: origCursorPositions,
        origTextSel: origTextSelections,
        segments: regexpInputSegments,
        config: config,
        myDelimiter: null,
    };
}
// Command 1: InsertSeqCommand - main command for inserting new sequences (default KEY: Ctrl+Alt+.)
async function InsertSeqCommand(context, value) {
    // get active editor, if not available show info message and return
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No active editor!');
        return;
    }
    // get global parameter (config, regex, original selections etc.) - will be passed to subfunctions
    const parameter = await initApp(editor);
    // get current alphabet from configuration and replace placeholder in regex
    const currentAlphabet = parameter.config.get('alphabet') || '\u{0}';
    parameter.segments['start_alpha'] = parameter.segments['start_alpha'].replace('\\w', `${currentAlphabet}`);
    // set input box options for sequence input, including placeHolder, predefined value if available and live preview as decorations
    const inputOptions = {
        placeHolder: '[<start>][:<step>][*<frequency>][#<repeat>][##startover][~<format>][::<expr>][@<stopexpr>][$][!]',
        value: value,
        validateInput: function (input) {
            insertNewSequence(input, parameter, 'preview');
            return '';
        },
    };
    // show input box based on above options
    vscode.window.showInputBox(inputOptions).then(function (input) {
        // insert final sequence (check if canceled will be done in insertNewSequence and in saveToHistory)
        insertNewSequence(input, parameter, 'final');
        (0, history_1.saveToHistory)(context, input);
    });
}
// Command 2: InsertSeqHistory - main command for browsing through history / preview entries (default KEY: Ctrl+Alt+,)
async function InsertSeqHistory(context, value) {
    // get active editor
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    // get global parameter (config, regex, original selections etc.) - will be passed to subfunctions
    const parameter = await initApp(editor);
    // build QuickPick items: top 'New sequence', then history newest-first
    const qp = createQuickPick(context, parameter);
    // show QuickPick
    qp.show();
}
// working horse: create new Sequence based on Input string, (global) Parameter and Status of input (preview or final)
function insertNewSequence(input, // der eingegebene Text
parameter, status) {
    // check, if output should be sorted or reversed (default: output in selection-order)
    const sorted = (input && input.match(parameter.segments['outputSort'])) ?? null;
    const reverse = (input && input.match(parameter.segments['outputReverse'])) ?? null;
    // get current sequence function based on input type
    const currSeqFunction = getSequenceFunction(input, parameter);
    // generate new sequence input strings (up to stop expression or maxInsertions)
    const strList = [];
    for (let i = 0; i < (Number(parameter.config.get('maxInsertions')) || 1000); i++) {
        // build strList-Array until stop expression is true or maxInsertions reached
        const res = currSeqFunction(i);
        if (res.stopFunction)
            break;
        strList.push(res.stringFunction);
    }
    // get delimiter and newLine settings from configuration (if insertations exceed number of selections)
    const delimiter = parameter.myDelimiter || parameter.config.get('delimiter') || null;
    // select proper EOL string for current document
    const eolString = parameter.editor.document.eol === vscode.EndOfLine.LF ? '\n' : '\r\n';
    // define preview decoration type if not yet done
    if (!previewDecorationType) {
        previewDecorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: parameter.config.previewColor ?? '#888888',
                margin: '0 0 0 0',
            },
        });
    }
    // clear previous decorations
    parameter.editor.setDecorations(previewDecorationType, []);
    // get sorted/reversed cursor positions for insertions
    const insertCursorPos = sortSelectionsByPosition(parameter.origCursorPos, sorted ? true : false, reverse ? true : false);
    // handle preview or final insertion
    switch (status) {
        case 'preview':
            // preview with Decorations
            // clear previous decorations
            const decorations = [];
            // safe last inserted string for possible appending at the end
            let addStr = '';
            // for each created string, create a decoration. If the number of created strings is higher than the number of original cursors, "new lines" will be inserted.
            strList.forEach((str, index) => {
                // create decoration at original cursor position as far as original cursor positions exist
                if (index < insertCursorPos.length) {
                    let decoration = {
                        range: new vscode.Range(insertCursorPos[index].start.line, insertCursorPos[index].start.character, insertCursorPos[index].end.line, insertCursorPos[index].end.character),
                        renderOptions: {
                            after: {
                                // replace spaces with non-breaking spaces for correct rendering as decoration
                                contentText: str.replace(/\s/g, '\u00A0'),
                            },
                        },
                    };
                    decorations.push(decoration);
                    // safe last inserted string for possible appending at the end
                    addStr = str;
                }
            });
            // if more created strings than original cursors, append the rest at the end (with delimiter or newline symbol)
            if (strList.length > insertCursorPos.length) {
                const lastPos = insertCursorPos[insertCursorPos.length - 1];
                decorations.pop();
                for (let i = insertCursorPos.length; i < strList.length; i++) {
                    addStr += (delimiter ? delimiter : '\u21b5') + strList[i]; // \u21b5 = downwards arrow with corner leftwards
                }
                let decoration = {
                    range: new vscode.Range(lastPos.start.line, lastPos.start.character, lastPos.end.line, lastPos.end.character),
                    renderOptions: {
                        after: {
                            contentText: addStr,
                        },
                    },
                };
                decorations.push(decoration);
            }
            parameter.editor.setDecorations(previewDecorationType, decorations);
            break;
        case 'final':
            // final insertion
            // clear previous decorations
            parameter.editor.setDecorations(previewDecorationType, []);
            try {
                previewDecorationType.dispose();
            }
            catch { }
            previewDecorationType = null;
            parameter.editor.edit((builder) => {
                let addStr = '';
                // if no strings created, use original selected text as backup
                if (strList.length === 0) {
                    parameter.origTextSel.map((s) => strList.push(s));
                }
                // for each created string, insert at original cursor position. If more strings than original cursors, insert the rest at the end (with delimiter or newline symbol)
                strList.forEach((str, index) => {
                    // insert strings in original Selection
                    const maxIndex = delimiter == null
                        ? insertCursorPos.length
                        : insertCursorPos.length - 1;
                    if (index < maxIndex) {
                        const currSel = new vscode.Selection(insertCursorPos[index].start.line, insertCursorPos[index].start.character, insertCursorPos[index].end.line, insertCursorPos[index].end.character);
                        builder.replace(currSel, str);
                    }
                    else {
                        // insert additional insertions as newlines
                        if (delimiter == null) {
                            // insert decoration at new line as long as not end of document
                            // at the end of document, insert additional lines
                            const currSel = new vscode.Position(insertCursorPos[maxIndex - 1].start.line + 1, 0);
                            // insert new line first if insert at last line of document
                            if (currSel.line ===
                                parameter.editor.document.lineCount) {
                                builder.insert(currSel, eolString + str);
                            }
                            else {
                                builder.insert(currSel, str + eolString);
                            }
                        }
                        else {
                            // insert additional strings with "delimiter"
                            addStr += str + delimiter;
                        }
                    }
                });
                if (addStr.length > 0) {
                    const lastPos = insertCursorPos[insertCursorPos.length - 1];
                    const currSel = new vscode.Range(lastPos.start.line, lastPos.start.character, lastPos.end.line, lastPos.end.character);
                    builder.replace(currSel, addStr.slice(0, -1).replace(/\s/g, '\u00A0'));
                }
            });
            break;
    }
}
// returns the proper sequence function based on input type
function getSequenceFunction(input, p) {
    // if input was "undefined" (canceled), return stopFunction true
    if (input == null) {
        const retStr = { stringFunction: '', stopFunction: true };
        return (i) => retStr;
    }
    // determine input type (based on input string beginning)
    const inputType = getInputType(input, p);
    // return proper sequence function based on input type
    switch (inputType) {
        case 'decimal':
            return createDecimalSeq(input, p, 10); // decimal
        case 'hex':
            return createDecimalSeq(input, p, 16); // hex
        case 'octal':
            return createDecimalSeq(input, p, 8); // octal
        case 'binary':
            return createDecimalSeq(input, p, 2); // binary
        case 'alpha':
            return createStringSeq(input, p); // strings
        case 'date':
            return createDateSeq(input, p); // dates (future: also time?)
        case 'expression':
            return createExpressionSeq(input, p); // expressions
        case 'own':
            return createOwnSeq(input, p); // own (war "months" in version 0.x) - custom alphabetic sequences
        case 'predefined':
            return createPredefinedSeq(input, p); // predefined text sequences (predefined lists in configuration)
        case 'textSelected':
            return createTextSelectedSeq(input, p); // no input - just use the originally selected text
        default:
            const retStr = { stringFunction: '', stopFunction: true };
            return (i) => retStr; // no valid input type detected, stop function
    }
}
// determines the input type based on the beginning of the input string
function getInputType(input, p) {
    let type = null;
    // get current alphabet from configuration
    const alphabet = p.config.get('alphabet') || '';
    // helper: regex-escape
    const escapeForRegex = (s) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // define regex for alphabetic characters based on current alphabet (from configuration)
    const chars = Array.from(alphabet).map(escapeForRegex).join('');
    const reAlphabetCharClass = new RegExp('^[' + chars + ']', 'iu');
    // What kind of input is it (check regex from begin)
    switch (true) {
        // hex numbers
        case /^(?:([x0\\s\\._])\1*)?[+-]?0x[0-9a-f]+/i.test(input):
            type = 'hex';
            break;
        // octal numbers
        case /^(?:([x0\\s\\._])\1*)?[+-]?0o[0-7]+/i.test(input):
            type = 'octal';
            break;
        // binary numbers
        case /^(?:([x0\\s\\._])\1*)?[+-]?0b[01]+/i.test(input):
            type = 'binary';
            break;
        // numbers (decimal)
        case /^(?:([x0\\s\\._])\1*)?[+-]?\d/i.test(input):
            type = 'decimal';
            break;
        // expression
        case /^\|/i.test(input):
            type = 'expression';
            break;
        // strings (alphabetic)
        case reAlphabetCharClass.test(input):
            type = 'alpha';
            break;
        // date values
        case /^%/i.test(input):
            type = 'date';
            break;
        // own sequences
        case /^\[/i.test(input):
            type = 'own';
            break;
        // predefined sequences
        case /^;/i.test(input):
            type = 'predefined';
            break;
        // empty input (when input box is empty) - use selected text if available or decimal as default
        case /^$/i.test(input):
        default:
            const selectedText = p.origTextSel.join('');
            if (selectedText.length > 0) {
                type = 'textSelected';
            }
            else {
                type = 'decimal';
            }
    }
    return type;
}
// creates decimal sequence function - used for decimal, hex, octal and binary sequences
function createDecimalSeq(input, parameter, base) {
    // extract parameters from input string or use configuration defaults
    const startMatch = input.match(parameter.segments['start_decimal']);
    // extract start value (with possible decimals), random number and delimiter
    const start = Number(startMatch?.groups?.start ?? parameter.config.get('start')) ?? 1;
    const startDecimals = startMatch?.groups?.startDecimals || '';
    const randomNumber = Number(startMatch?.groups?.rndNumber) || 0;
    const randomDecimal = startMatch?.groups?.rndDecimals || '';
    const randomPlusMinus = startMatch?.groups?.rndPlusMinus || null;
    const leadString = startMatch?.groups?.lead_string;
    const randomAvailable = startMatch?.groups?.rndAvailable || null;
    const myDelimiter = startMatch?.groups?.seqdelimiter || null;
    // set custom delimiter if given in input
    parameter.myDelimiter = myDelimiter;
    // extract steps, repetition, frequency, startover, stop expression and expression
    const steps = Number(input.match(parameter.segments['steps_decimal'])?.groups?.steps ??
        parameter.config.get('step')) || 1;
    const repe = Number(input.match(parameter.segments['repetition'])?.groups?.repeat ??
        parameter.config.get('repetition')) || Number.MAX_SAFE_INTEGER;
    const freq = Number(input.match(parameter.segments['frequency'])?.groups?.freq ??
        parameter.config.get('frequency')) || 1;
    const startover = Number(input.match(parameter.segments['startover'])?.groups?.startover ??
        parameter.config.get('startover')) || Number.MAX_SAFE_INTEGER;
    const stopexpr = input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ??
        '';
    const expr = input.match(parameter.segments['expression'])?.groups?.expr ?? '';
    // determine if radix prefix is requested
    const radixPrefix = base !== 10
        ? startMatch?.groups?.radixPrefix !== undefined
            ? String(startMatch?.groups?.radixPrefix) === '1'
            : parameter.config.get('radixPrefix') !== undefined
                ? parameter.config.get('radixPrefix') === true
                : false
        : false;
    // determine format string based on base
    const basePrefix = base === 16 ? '#x' : base === 8 ? '#o' : base === 2 ? '#b' : '';
    // format string: leading string (if given) or radixPrefix if given or format from input or configuration or empty
    const format = leadString
        ? leadString[0] + '>' + input.length
        : radixPrefix
            ? basePrefix
            : String(input.match(parameter.segments['format_decimal'])?.groups
                ?.format_decimal ??
                parameter.config.get('format') ??
                '');
    // prepare special replacement values for expressions and stop expressions
    const replacableValues = {
        currentValueStr: '',
        valueAfterExpressionStr: '',
        previousValueStr: '0',
        startStr: parameter.config.get('start') || '1',
        stepStr: parameter.config.get('step') || '1',
        numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
        currentIndexStr: '',
        origTextStr: '',
    };
    // return the sequence function (i = current index of insertion, starting with 0)
    return (i) => {
        let value = start;
        if (randomAvailable) {
            // generate random number based on given input
            const maxNumber = randomPlusMinus !== null ? start + randomNumber : randomNumber;
            // generate random number between start and maxNumber
            if (start <= maxNumber) {
                value = Number(Number(start +
                    Math.random() *
                        (maxNumber -
                            start +
                            0.5 * 10 ** (-randomDecimal.length - 1))).toFixed(randomDecimal.length));
            }
            else {
                // show info message and stop function if maxNumber < start
                vscode.window.showInformationMessage('InsertSeq: Random number maximum is less than start value!');
                return {
                    stringFunction: '',
                    stopFunction: true,
                };
            }
        }
        else {
            // calculate current value based on start, step, frequency, repetition and startover
            value =
                start +
                    steps * Math.trunc(((i % startover) % (freq * repe)) / freq);
        }
        // set special replacement values for origTextStr and currentIndexStr
        if (i <= parameter.origTextSel.length) {
            replacableValues.origTextStr = parameter.origTextSel[i];
        }
        replacableValues.currentIndexStr = i.toString();
        // set current value string before expression evaluation
        replacableValues.currentValueStr = value.toString(base);
        // if expression exists, evaluate expression with current Value and replace newValue with result of expression.
        // if expression does not lead to a number, the current / new value will not be changed
        try {
            let exprResult = runExpression(replaceSpecialChars(expr, replacableValues));
            if (Number.isFinite(exprResult))
                value = Number(exprResult);
        }
        catch {
            // ignore errors in expression evaluation - keep current value;
        }
        // set value after expression evaluation
        replacableValues.valueAfterExpressionStr = value.toString(base);
        // default: stop expression triggered if i >= number of original selections
        let stopExpressionTriggered = i >= parameter.origCursorPos.length;
        // check stop expression if given
        if (stopexpr.length > 0) {
            // calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
            try {
                const stopExprResult = runExpression(replaceSpecialChars(stopexpr, replacableValues));
                if (stopExprResult != null) {
                    stopExpressionTriggered = Boolean(stopExprResult);
                }
                else {
                    stopExpressionTriggered =
                        i >= parameter.origCursorPos.length;
                }
            }
            catch {
                stopExpressionTriggered = i >= parameter.origCursorPos.length;
            }
        }
        else {
            stopExpressionTriggered = i >= parameter.origCursorPos.length;
        }
        // set previous value string for next iteration
        replacableValues.previousValueStr = value.toString();
        // apply formatting if format string is given and return formatted value
        if (format && format !== '') {
            return {
                stringFunction: formatting.formatNumber(value, format),
                stopFunction: stopExpressionTriggered,
            };
        }
        else {
            if (startDecimals === '') {
                let prefixStr = '';
                if (radixPrefix) {
                    switch (base) {
                        case 16:
                            prefixStr = '0x';
                            break;
                        case 8:
                            prefixStr = '0o';
                            break;
                        case 2:
                            prefixStr = '0b';
                            break;
                    }
                }
                return {
                    stringFunction: prefixStr + value.toString(base),
                    stopFunction: stopExpressionTriggered,
                };
            }
            else {
                return {
                    stringFunction: value.toFixed(startDecimals.length),
                    stopFunction: stopExpressionTriggered,
                };
            }
        }
    };
}
// creates string sequence function - used for alphabetic sequences
function createStringSeq(input, parameter) {
    // utility functions for string to index and index to string conversion - unicode-graphem aware
    function stringToIndex(str) {
        const chars = Array.from(str); // Unicode-Graphem
        let index = 0;
        for (const ch of chars) {
            const charIndex = charToIndex.get(ch);
            if (charIndex === undefined) {
                throw new Error(`Char "${ch}" not in alphabet.`);
            }
            index = index * alphabetLen + charIndex;
        }
        // all combinations with fewer characters
        for (let len = 1; len < chars.length; len++) {
            index += Math.pow(alphabetLen, len);
        }
        return index;
    }
    function indexToString(index) {
        if (index < 0) {
            throw new Error('Index below possible values!');
        }
        let length = 1;
        let count = 0;
        while (true) {
            const combinations = Math.pow(alphabetLen, length);
            if (index < count + combinations)
                break;
            count += combinations;
            length++;
        }
        index -= count;
        const chars = [];
        for (let i = 0; i < length; i++) {
            chars.unshift(alphabetArr[index % alphabetLen]);
            index = Math.floor(index / alphabetLen);
        }
        return chars.join('');
    }
    // extract start value as regex group to allow lowercase/uppercase detection
    const startRegEx = new RegExp(parameter.segments['start_alpha'], 'i');
    const startMatch = input.match(startRegEx);
    const start = startMatch?.groups?.start || '';
    // default return if start is empty
    const defaultReturn = { stringFunction: '', stopFunction: true };
    if (start === '')
        return (i) => defaultReturn;
    // extract steps, repetition, frequency, startover, stop expression, expression and format
    const steps = Number(input.match(parameter.segments['steps_other'])?.groups?.steps) ||
        Number(parameter.config.get('step')) ||
        1;
    const repe = Number(input.match(parameter.segments['repetition'])?.groups?.repeat) ||
        Number(parameter.config.get('repetition')) ||
        Number.MAX_SAFE_INTEGER;
    const freq = Number(input.match(parameter.segments['frequency'])?.groups?.freq) ||
        Number(parameter.config.get('frequency')) ||
        1;
    const startover = Number(input.match(parameter.segments['startover'])?.groups?.startover) ||
        Number(parameter.config.get('startover')) ||
        Number.MAX_SAFE_INTEGER;
    const stopexpr = input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ||
        '';
    const expr = input.match(parameter.segments['expression'])?.groups?.expr || '';
    const format = input.match(parameter.segments['format_alpha'])?.groups?.format_alpha ||
        '';
    // determine capitalization, default: preserve original capitalization (from rightmost characters)
    let capital = 'preserve';
    // check global configuration first
    switch (String(parameter.config.get('alphaCapital') || '').toLocaleLowerCase()) {
        case 'upper':
            capital = 'upper';
            break;
        case 'lower':
            capital = 'lower';
            break;
        case 'pascal':
            capital = 'pascal';
            break;
    }
    // then check input capitalization options
    switch (String(startMatch?.groups?.alphacapital).toLocaleLowerCase()) {
        case 'u':
            capital = 'upper';
            break;
        case 'l':
            capital = 'lower';
            break;
        case 'p':
            capital = 'pascal';
            break;
    }
    // support string or array in configuration
    const alphabetRaw = parameter.config.get('alphabet') || 'abcdefghijklmnopqrstuvwxyz';
    const alphabetArr = Array.isArray(alphabetRaw)
        ? alphabetRaw.map(String)
        : Array.from(String(alphabetRaw));
    // check alphabet for unique entries
    const uniqAlphabet = new Set(alphabetArr);
    if (uniqAlphabet.size !== alphabetArr.length) {
        throw new Error('Alphabet includes double entries!');
    }
    const charToIndex = new Map();
    // Build mapping that accepts both lower/upper input forms but keeps alphabetArr as canonical output values
    alphabetArr.forEach((char, i) => {
        charToIndex.set(char, i);
        const lower = char.toLowerCase();
        const upper = char.toUpperCase();
        if (!charToIndex.has(lower))
            charToIndex.set(lower, i);
        if (!charToIndex.has(upper))
            charToIndex.set(upper, i);
    });
    const alphabetLen = alphabetArr.length;
    // prepare special replacement values for expressions and stop expressions
    const replacableValues = {
        currentValueStr: '',
        valueAfterExpressionStr: '',
        previousValueStr: '',
        currentIndexStr: '',
        origTextStr: '',
        startStr: parameter.config.get('start') || '1',
        stepStr: parameter.config.get('step') || '1',
        numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
    };
    // get current index of start string
    const currentIndex = stringToIndex(start);
    // return the sequence function (i = current index of insertion, starting with 0)
    return (i) => {
        if (i <= parameter.origTextSel.length) {
            replacableValues.origTextStr = parameter.origTextSel[i];
        }
        else {
            replacableValues.origTextStr = '';
        }
        // set current index string
        replacableValues.currentIndexStr = i.toString();
        // calculate current value based on start, step, frequency, repetition and startover
        let value = indexToString(currentIndex +
            steps * Math.trunc(((i % startover) % (freq * repe)) / freq));
        // set current value string before expression evaluation
        replacableValues.currentValueStr = value;
        // if expression does not lead to a string, the current / new value will not be changed
        try {
            let tempValue = runExpression(replaceSpecialChars(expr, replacableValues));
            if (typeof tempValue === 'string' || tempValue instanceof String) {
                value = String(tempValue);
            }
        }
        catch { }
        // set value after expression evaluation
        replacableValues.valueAfterExpressionStr = value;
        // default: stop expression triggered if i >= number of original selections
        let stopExprResult = i >= parameter.origCursorPos.length;
        // calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
        if (stopexpr.length > 0) {
            try {
                const exprResult = runExpression(replaceSpecialChars(stopexpr, replacableValues));
                if (exprResult) {
                    stopExprResult = Boolean(exprResult);
                }
                else {
                    stopExprResult = i >= parameter.origCursorPos.length;
                }
            }
            catch {
                stopExprResult = i >= parameter.origCursorPos.length;
            }
        }
        else {
            stopExprResult = i >= parameter.origCursorPos.length;
        }
        // set previous value string for next iteration
        replacableValues.previousValueStr = value;
        // change capitalization based on settings
        switch (capital) {
            case 'upper':
                value = value.toUpperCase();
                break;
            case 'lower':
                value = value.toLowerCase();
                break;
            case 'pascal':
                value =
                    value.charAt(0).toUpperCase() +
                        value.slice(1).toLowerCase();
                break;
            default:
                // preserve original capitalization (from rightmost characters)
                for (let idx = value.length - 1; idx >= 0; idx--) {
                    const ch = value.charAt(idx);
                    const origCh = start.charAt(Math.max(0, start.length - value.length + idx));
                    if (origCh.toUpperCase() === origCh) {
                        value =
                            value.slice(0, idx) +
                                ch.toUpperCase() +
                                value.slice(idx + 1);
                    }
                    else {
                        value =
                            value.slice(0, idx) +
                                ch.toLowerCase() +
                                value.slice(idx + 1);
                    }
                }
                break;
        }
        return {
            stringFunction: formatting.formatString(value, format),
            stopFunction: stopExprResult,
        };
    };
}
function createDateSeq(input, parameter) {
    // if only "%", without additional digits, is given, use current date as start date
    if (input.match(/^%(?!\d)/)) {
        input = '%' + temporal_polyfill_1.Temporal.Now.plainDateISO().toString() + input.slice(1);
    }
    // extract start date
    let start = input.match(parameter.segments['start_date'])?.groups?.start;
    // if start date is empty, use current date
    if (start === '')
        start = temporal_polyfill_1.Temporal.Now.plainDateISO().toString();
    // if no start date found, return empty function
    const defaultReturn = { stringFunction: '', stopFunction: true };
    if (!start)
        return (i) => defaultReturn;
    const startGroups = input.match(parameter.segments['start_date'])?.groups;
    const dateParts = { year: 0, month: 0, day: 0 };
    if (startGroups?.datepart) {
        let yearStr = input.match(parameter.segments['start_date'])?.groups?.year ||
            temporal_polyfill_1.Temporal.Now.plainDateISO().year.toString();
        if (yearStr.length === 2)
            yearStr = parameter.config.get('century') + yearStr;
        dateParts.year = Number(yearStr) || temporal_polyfill_1.Temporal.Now.plainDateISO().year;
        dateParts.month =
            Number(input.match(parameter.segments['start_date'])?.groups?.month) || temporal_polyfill_1.Temporal.Now.plainDateISO().month;
        dateParts.day =
            Number(input.match(parameter.segments['start_date'])?.groups?.day) || temporal_polyfill_1.Temporal.Now.plainDateISO().day;
    }
    else {
        // currently no valie date input - might change in the future
        vscode.window.showInformationMessage('No date found!');
        return (i) => defaultReturn;
    }
    const steps = Number(input.match(parameter.segments['steps_date'])?.groups?.steps) ||
        Number(parameter.config.get('step')) ||
        1;
    const unit = input.match(parameter.segments['steps_date'])?.groups?.date_unit ||
        parameter.config.get('date_unit') ||
        'd';
    const repe = Number(input.match(parameter.segments['repetition'])?.groups?.repeat) ||
        Number(parameter.config.get('repetition')) ||
        Number.MAX_SAFE_INTEGER;
    const freq = Number(input.match(parameter.segments['frequency'])?.groups?.freq) ||
        Number(parameter.config.get('frequency')) ||
        1;
    const startover = Number(input.match(parameter.segments['startover'])?.groups?.startover) ||
        Number(parameter.config.get('startover')) ||
        Number.MAX_SAFE_INTEGER;
    const expr = input.match(parameter.segments['expression'])?.groups?.expr || '';
    const stopexpr = input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ||
        '';
    const format = input.match(parameter.segments['format_date'])?.groups?.dateformat ||
        parameter.config.get('format') ||
        '';
    const language = input.match(parameter.segments['format_date'])?.groups?.language ||
        parameter.config.get('language') ||
        undefined;
    const instant = temporal_polyfill_1.Temporal.PlainDateTime.from({
        year: dateParts.year,
        month: dateParts.month,
        day: dateParts.day,
        hour: 0,
        minute: 0,
        second: 0,
        millisecond: 0,
        microsecond: 0,
        nanosecond: 0,
    });
    const replacableValues = {
        currentValueStr: '',
        valueAfterExpressionStr: '',
        previousValueStr: '',
        currentIndexStr: '',
        origTextStr: '',
        startStr: parameter.config.get('start') || '1',
        stepStr: parameter.config.get('step') || '1',
        numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
    };
    return (i) => {
        function calculateDateOffset(baseDate, offset) {
            let idx = steps *
                Math.trunc(((offset % startover) % (freq * repe)) / freq);
            let value;
            if (idx >= 0) {
                switch (unit.toLowerCase()) {
                    case 'w':
                        value = baseDate.add({ weeks: idx });
                        break;
                    case 'm':
                        value = baseDate.add({ months: idx });
                        break;
                    case 'y':
                        value = baseDate.add({ years: idx });
                        break;
                    default:
                        value = baseDate.add({ days: idx });
                        break;
                }
            }
            else {
                switch (unit.toLowerCase()) {
                    case 'w':
                        value = baseDate.subtract({
                            weeks: Math.abs(idx),
                        });
                        break;
                    case 'm':
                        value = baseDate.subtract({
                            months: Math.abs(idx),
                        });
                        break;
                    case 'y':
                        value = baseDate.subtract({
                            years: Math.abs(idx),
                        });
                        break;
                    default:
                        value = baseDate.subtract({
                            days: Math.abs(idx),
                        });
                        break;
                }
            }
            return value;
        }
        if (i <= parameter.origTextSel.length) {
            replacableValues.origTextStr = parameter.origTextSel[i];
        }
        else {
            replacableValues.origTextStr = '';
        }
        replacableValues.currentIndexStr = i.toString();
        let value = calculateDateOffset(instant, i);
        replacableValues.currentValueStr = value
            .toPlainDate()
            .toLocaleString(language);
        // if expression exists, evaluate expression with current Value and replace newValue with result of expression.
        try {
            let exprResult = runExpression(replaceSpecialChars(expr, replacableValues));
            if (typeof exprResult === 'string' ||
                exprResult instanceof String) {
                const tempDate = temporal_polyfill_1.Temporal.PlainDate.from(String(exprResult));
                value = temporal_polyfill_1.Temporal.PlainDateTime.from({
                    year: tempDate.year,
                    month: tempDate.month,
                    day: tempDate.day,
                    hour: 0,
                    minute: 0,
                    second: 0,
                    millisecond: 0,
                    microsecond: 0,
                    nanosecond: 0,
                });
            }
        }
        catch {
            // ignore errors in expression evaluation - keep current value;
        }
        replacableValues.valueAfterExpressionStr = value
            .toPlainDate()
            .toLocaleString(language);
        let stopExprResult = false;
        // calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
        if (stopexpr.length > 0) {
            try {
                const exprResult = runExpression(replaceSpecialChars(stopexpr, replacableValues));
                if (exprResult) {
                    stopExprResult = Boolean(exprResult);
                }
                else {
                    stopExprResult = i >= parameter.origCursorPos.length;
                }
            }
            catch {
                stopExprResult = i >= parameter.origCursorPos.length;
            }
        }
        else {
            stopExprResult = i >= parameter.origCursorPos.length;
        }
        replacableValues.previousValueStr = value
            .toPlainDate()
            .toLocaleString(language);
        return {
            stringFunction: formatting.formatTemporalDateTime(value, format, language),
            stopFunction: stopExprResult,
        };
    };
}
// Create sequence based on expression
function createExpressionSeq(input, parameter) {
    // const retFunction = { stringFunction: '', stopFunction: true };
    // return (i) => retFunction;
    const expr = input.match(parameter.segments['start_expression'])?.groups?.start ||
        '';
    const stopexpr = input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ||
        '';
    const format = input.match(parameter.segments['format_decimal'])?.groups
        ?.format_decimal || '';
    const replacableValues = {
        currentValueStr: '',
        valueAfterExpressionStr: '', // only for stopexpression
        previousValueStr: '',
        currentIndexStr: '',
        origTextStr: '',
        startStr: parameter.config.get('start') || '1',
        stepStr: parameter.config.get('step') || '1',
        numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
    };
    // return function for each index/item
    return (i) => {
        if (i <= parameter.origTextSel.length) {
            replacableValues.origTextStr = parameter.origTextSel[i];
            // set current value to original selection text for use in expression
            replacableValues.currentValueStr = parameter.origTextSel[i];
        }
        replacableValues.currentIndexStr = i.toString();
        try {
            const exprResult = runExpression(replaceSpecialChars(expr, replacableValues));
            if (typeof exprResult === 'string' ||
                exprResult instanceof String) {
                replacableValues.currentValueStr = String(exprResult);
            }
            else if (typeof exprResult === 'number') {
                replacableValues.currentValueStr = exprResult.toString();
            }
            else {
                replacableValues.currentValueStr = '';
            }
        }
        catch {
            replacableValues.currentValueStr = '';
        }
        // set value after expression evaluation (not different from current value here, but for consistency, but to work with stopexpr)
        replacableValues.valueAfterExpressionStr =
            replacableValues.currentValueStr;
        let stopExprResult = false;
        // calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
        if (stopexpr.length > 0) {
            try {
                stopExprResult = runExpression(replaceSpecialChars(stopexpr, replacableValues));
                if (stopExprResult) {
                    stopExprResult = Boolean(stopExprResult);
                }
                else {
                    stopExprResult = i >= parameter.origCursorPos.length;
                }
            }
            catch {
                stopExprResult = i >= parameter.origCursorPos.length;
            }
        }
        else {
            stopExprResult = i >= parameter.origCursorPos.length;
        }
        replacableValues.previousValueStr = replacableValues.currentValueStr;
        return {
            stringFunction: replacableValues.currentValueStr,
            stopFunction: stopExprResult,
        };
    };
}
// Create own sequence base on direct input
function createOwnSeq(input, parameter) {
    const sequenceSet = input.match(parameter.segments['start_own'])?.groups?.ownseq || '';
    const start = parseInt(input.match(parameter.segments['start_own'])?.groups?.startseq ||
        '1') || 1;
    const steps = Number(input.match(parameter.segments['steps_other'])?.groups?.steps) ||
        Number(parameter.config.get('step')) ||
        1;
    const repe = Number(input.match(parameter.segments['repetition'])?.groups?.repeat ??
        parameter.config.get('repetition')) || Number.MAX_SAFE_INTEGER;
    const freq = Number(input.match(parameter.segments['frequency'])?.groups?.freq ??
        parameter.config.get('frequency')) || 1;
    const startover = Number(input.match(parameter.segments['startover'])?.groups?.startover ??
        parameter.config.get('startover')) || Number.MAX_SAFE_INTEGER;
    const format = input.match(parameter.segments['format_alpha'])?.groups?.format_alpha ||
        '';
    const stopexpr = input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ||
        '';
    let ownSeq = [];
    if (sequenceSet.length > 0) {
        ownSeq = sequenceSet
            .split(/\s*[;,]\s*/) // Split an Komma oder Semikolon mit optionalen Leerzeichen davor und danach
            .filter(Boolean); // Entfernt leere Strings, falls vorhanden
    }
    const replacableValues = {
        currentValueStr: '',
        valueAfterExpressionStr: '', // only for stopexpression
        previousValueStr: '',
        currentIndexStr: '',
        origTextStr: '',
        startStr: parameter.config.get('start') || '1',
        stepStr: parameter.config.get('step') || '1',
        numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
    };
    return (i) => {
        replacableValues.currentIndexStr = i.toString();
        replacableValues.origTextStr =
            i < parameter.origTextSel.length ? parameter.origTextSel[i] : '';
        replacableValues.currentValueStr =
            i < ownSeq.length
                ? ownSeq[(start -
                    1 +
                    steps *
                        Math.trunc(((i % startover) % (freq * repe)) / freq)) %
                    ownSeq.length]
                : '';
        if (ownSeq.length === 0) {
            return { stringFunction: '', stopFunction: true };
        }
        else {
            // calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
            let stopExprResult = false;
            if (stopexpr.length > 0) {
                try {
                    stopExprResult = runExpression(replaceSpecialChars(stopexpr, replacableValues));
                    if (stopExprResult) {
                        stopExprResult = Boolean(stopExprResult);
                    }
                    else {
                        stopExprResult = i >= parameter.origCursorPos.length;
                    }
                }
                catch {
                    stopExprResult = i >= parameter.origCursorPos.length;
                }
            }
            else {
                stopExprResult = i >= parameter.origCursorPos.length;
            }
            replacableValues.previousValueStr =
                replacableValues.currentValueStr;
            return {
                stringFunction: formatting.formatString(ownSeq[(start -
                    1 +
                    steps *
                        Math.trunc(((i % startover) % (freq * repe)) / freq)) %
                    ownSeq.length] || '', format),
                stopFunction: stopExprResult,
            };
        }
    };
}
// Create predefined own sequence from configuration
function createPredefinedSeq(input, parameter) {
    function arrayIncludesString(x, a, options) {
        const { ignoreCase = false, emptyMatchesAll = false, fullMatch = false, startsWith = false, } = options || {};
        if (x == null)
            return -1;
        if (x.length === 0 && !emptyMatchesAll)
            return -1;
        switch (true) {
            case fullMatch && ignoreCase:
                return a.findIndex((s) => s.toLocaleLowerCase() === x.toLocaleLowerCase());
            case ignoreCase:
                return a.findIndex((s) => s.toLocaleLowerCase().startsWith(x.toLocaleLowerCase()));
            case fullMatch:
                return a.findIndex((s) => s === x);
            case startsWith:
                return a.findIndex((s) => s.startsWith(x));
            default:
                return a.findIndex((s) => s.includes(x));
        }
    }
    const predefinedSeq = parameter.config.get('ownsequences') || [
        [],
    ];
    const sequenceText = input.match(parameter.segments['start_predefined'])?.groups
        ?.start_predefined || '';
    const sequenceOptions = input.match(parameter.segments['start_predefined'])?.groups
        ?.predefinedopts || '';
    const searchOptions = {
        ignoreCase: sequenceOptions.toLocaleLowerCase().indexOf('i') > -1,
        fullMatch: sequenceOptions.toLocaleLowerCase().indexOf('f') > -1,
        startsWith: sequenceOptions.toLocaleLowerCase().indexOf('s') > -1,
    };
    const parseDigits = sequenceOptions.match(/(\d+)(?:\|(\d+)?)?/);
    const sequenceNumber = parseInt(parseDigits && parseDigits.length > 0 ? parseDigits[1] : '0');
    const sequenceStart = parseInt(parseDigits && parseDigits.length > 1 ? parseDigits[2] : '1') || 1;
    let ownSeq = [];
    let start = 0;
    const steps = Number(input.match(parameter.segments['steps_other'])?.groups?.steps) ||
        Number(parameter.config.get('step')) ||
        1;
    const repe = Number(input.match(parameter.segments['repetition'])?.groups?.repeat ??
        parameter.config.get('repetition')) || Number.MAX_SAFE_INTEGER;
    const freq = Number(input.match(parameter.segments['frequency'])?.groups?.freq ??
        parameter.config.get('frequency')) || 1;
    const startover = Number(input.match(parameter.segments['startover'])?.groups?.startover ??
        parameter.config.get('startover')) || Number.MAX_SAFE_INTEGER;
    const stopexpr = input.match(parameter.segments['stopexpression'])?.groups?.stopexpr ||
        '';
    if (sequenceText.length > 0) {
        if (sequenceNumber >= 1 && sequenceNumber <= predefinedSeq.length) {
            let index = arrayIncludesString(sequenceText, predefinedSeq[sequenceNumber - 1], searchOptions);
            if (index > -1) {
                ownSeq = predefinedSeq[sequenceNumber - 1];
                start = index;
            }
        }
        else {
            for (let i = 0; i < predefinedSeq.length; i++) {
                let l = arrayIncludesString(sequenceText, predefinedSeq[i], searchOptions);
                if (l > -1) {
                    ownSeq = predefinedSeq[i];
                    start = l;
                    break;
                }
            }
        }
    }
    else {
        if (sequenceNumber >= 1 && sequenceNumber <= predefinedSeq.length) {
            ownSeq = predefinedSeq[sequenceNumber - 1];
            start = (sequenceStart - 1) % ownSeq.length;
        }
    }
    const replacableValues = {
        currentValueStr: '',
        valueAfterExpressionStr: '', // only for stopexpression
        previousValueStr: '',
        currentIndexStr: '',
        origTextStr: '',
        startStr: parameter.config.get('start') || '1',
        stepStr: parameter.config.get('step') || '1',
        numberOfSelectionsStr: parameter.origCursorPos.length.toString(),
    };
    return (i) => {
        replacableValues.currentIndexStr = i.toString();
        replacableValues.origTextStr =
            i < parameter.origTextSel.length ? parameter.origTextSel[i] : '';
        const value = i < ownSeq.length
            ? ownSeq[(start +
                steps *
                    Math.trunc(((i % startover) % (freq * repe)) / freq)) %
                ownSeq.length]
            : '';
        replacableValues.currentValueStr = value;
        replacableValues.valueAfterExpressionStr =
            replacableValues.currentValueStr;
        if (ownSeq.length === 0) {
            return { stringFunction: '', stopFunction: true };
        }
        else {
            // calculate possible stop expression. If stop expression is true, a "\u{0}" char will be returned. If stop expression is invalid or false, the newValue will be returned
            let stopExprTrigger = false;
            if (stopexpr.length > 0) {
                try {
                    const exprResult = runExpression(replaceSpecialChars(stopexpr, replacableValues));
                    if (exprResult) {
                        stopExprTrigger = Boolean(exprResult);
                    }
                    else {
                        stopExprTrigger = i >= parameter.origCursorPos.length;
                    }
                }
                catch {
                    stopExprTrigger = i >= parameter.origCursorPos.length;
                }
            }
            else {
                stopExprTrigger = i >= parameter.origCursorPos.length;
            }
            replacableValues.previousValueStr =
                replacableValues.currentValueStr;
            return {
                stringFunction: value,
                stopFunction: stopExprTrigger,
            };
        }
    };
}
// Create sequence based on original selected text
function createTextSelectedSeq(input, parameter) {
    return (i) => {
        return {
            stringFunction: parameter.origTextSel[i] || '',
            stopFunction: i >= parameter.origCursorPos.length,
        };
    };
}
function createQuickPick(context, parameter) {
    // build QuickPick items: top 'New sequence', then history newest-first
    const qp = vscode.window.createQuickPick();
    const items = [];
    items.push({
        label: '$(add) New sequence',
        description: 'Start a new sequence',
        cmd: '',
    });
    // create items with a delete button each (trash icon)
    const history = (0, history_1.getHistory)(context) || [];
    for (const h of history) {
        items.push({
            label: h,
            description: '',
            cmd: h,
            buttons: [
                {
                    iconPath: new vscode.ThemeIcon('edit'),
                    tooltip: 'Edit this history entry',
                },
                {
                    iconPath: new vscode.ThemeIcon('trash'),
                    tooltip: 'Delete this history entry',
                },
            ],
        });
    }
    qp.items = items;
    qp.placeholder = 'Choose "New sequence" or any of the last entries';
    qp.matchOnDescription = true;
    function schedulePreview(cmd) {
        if (!cmd) {
            // clear preview decorations
            if (previewDecorationType)
                parameter.editor.setDecorations(previewDecorationType, []);
        }
        else {
            // call preview
            try {
                insertNewSequence(cmd, parameter, 'preview');
            }
            catch (e) {
                printToConsole('Function: schedulePreview - preview error: ' + e);
            }
        }
    }
    qp.onDidChangeActive((activeItems) => {
        const active = activeItems[0];
        if (!active || !active.cmd) {
            schedulePreview(undefined);
            return;
        }
        schedulePreview(active.cmd);
    });
    // handle clicking the per-item buttons (delete / edit)
    qp.onDidTriggerItemButton(async (e) => {
        const item = e.item;
        if (!item || !item.cmd)
            return;
        const tooltip = (e.button && e.button.tooltip) || '';
        if (tooltip === 'Delete this history entry') {
            // delete from storage
            await (0, history_1.deleteFromHistory)(context, item.cmd);
            // remove from quickpick items
            qp.items = qp.items.filter((i) => i.cmd !== item.cmd);
            // clear preview if the deleted item was active
            const active = qp.activeItems[0];
            if (!active || !active.cmd) {
                schedulePreview(undefined);
            }
            else {
                schedulePreview(active.cmd);
            }
        }
        else if (tooltip === 'Edit this history entry') {
            // Hide quickpick and launch InsertSeqCommand with the selected history item
            qp.hide();
            await InsertSeqCommand(context, item.cmd);
        }
    });
    // add a toolbar Clear button to clear all history
    qp.buttons = [
        {
            iconPath: new vscode.ThemeIcon('trash'),
            tooltip: 'Clear all history',
        },
    ];
    qp.onDidTriggerButton(async (button) => {
        // Confirm
        const ans = await vscode.window.showWarningMessage('Clear entire history?', { modal: true }, 'Clear');
        if (ans !== 'Clear')
            return;
        await (0, history_1.clearHistory)(context);
        // reset quickpick items to only New sequence
        qp.items = [
            {
                label: '$(add) New sequence',
                description: 'Start a new sequence',
                cmd: '',
            },
        ];
        schedulePreview(undefined);
    });
    qp.onDidAccept(async () => {
        const chosen = qp.activeItems[0];
        if (!chosen) {
            qp.hide();
            return;
        }
        if (!chosen.cmd) {
            // New sequence selected -> delegate to InsertSeqCommand
            qp.hide();
            await InsertSeqCommand(context, '');
            return;
        }
        // history item selected -> final execution
        qp.busy = true;
        try {
            insertNewSequence(chosen.cmd, parameter, 'final');
            // save to history (will no-op if already present)
            await (0, history_1.saveToHistory)(context, chosen.cmd);
        }
        finally {
            qp.busy = false;
            qp.hide();
        }
    });
    qp.onDidHide(() => {
        // clear preview decorations
        if (previewDecorationType)
            parameter.editor.setDecorations(previewDecorationType, []);
        qp.dispose();
    });
    return qp;
}
function replaceSpecialChars(st, para) {
    // _ ::= current value (before expression)
    // o ::= original text under current selection
    // c ::= current value (only for stopexpression, includes value after expression)
    // p ::= previous value
    // a ::= value of <start>
    // s ::= value of <step>
    // n ::= number of selections
    // i ::= counter, starting with 0 and increasing with each insertion
    return st
        .replace(/\b_\b/gi, Number.isFinite(para.currentValueStr)
        ? para.currentValueStr
        : `'${para.currentValueStr}'`)
        .replace(/\bo\b/gi, Number.isFinite(para.origTextStr)
        ? para.origTextStr
        : `'${para.origTextStr}'`)
        .replace(/\bc\b/gi, Number.isFinite(para.valueAfterExpressionStr)
        ? para.valueAfterExpressionStr
        : `'${para.valueAfterExpressionStr}'`)
        .replace(/\bp\b/gi, Number.isFinite(para.previousValueStr)
        ? para.previousValueStr
        : `'${para.previousValueStr}'`)
        .replace(/\ba\b/gi, para.startStr)
        .replace(/\bs\b/gi, para.stepStr)
        .replace(/\bn\b/gi, para.numberOfSelectionsStr)
        .replace(/\bi\b/gi, para.currentIndexStr);
}
function runExpression(str) {
    // strip surrounding quotes
    if (str[0] === '"' && str[str.length - 1] === '"') {
        str = str.slice(1, -1);
    }
    if (str[0] === "'" && str[str.length - 1] === "'") {
        str = str.slice(1, -1);
    }
    try {
        let res;
        try {
            // dynamically require the safeEval helper if available
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            // const se = require('./safeEval');
            res = safeEval_1.safeEvaluate ? (0, safeEval_1.safeEvaluate)(str, 1000) : null;
        }
        catch {
            res = null;
        }
        if (res && typeof res === 'object') {
            if (!res.ok)
                return null;
            return res.value;
        }
        // // fallback to eval if safeEvaluate not available
        // const result = eval(str);
        // return result;
        return null;
    }
    catch {
        return null;
    }
}
// Get regular expressions for segmenting the input string
function getRegExpressions() {
    const matchRule = {
        start_decimal: '', // start Wert bei Zahlen
        start_alpha: '', // Start-Wert bei Buchstaben
        start_date: '', // Start-Wert bei Datumseingabe
        start_own: '', // Start-Wert bei eigenen Listen (string)
        start_predefined: '', // Start-Wert in der Configuration vordefinierte Listen (string)
        start_expression: '', // Start-Wert bei Ausdrücken
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
    const ruleTemplate = {};
    ruleTemplate.charStartDate = `%`;
    ruleTemplate.charStartOwnSequence = `\\[`;
    ruleTemplate.charStartPredefinedSequence = `;`;
    ruleTemplate.charStartExpr = `\\|`;
    ruleTemplate.charStartSteps = `:`;
    ruleTemplate.charStartFormat = `~`;
    ruleTemplate.charStartFrequency = `\\*`;
    ruleTemplate.charStartRepetition = `#`;
    ruleTemplate.charStartStartover = `##`;
    ruleTemplate.charStartExpression = `::`;
    ruleTemplate.charStartStopExpression = `@`;
    // optional information after charStartOptions
    ruleTemplate.charStartOptions = `\\?`;
    ruleTemplate.specialchars = `(?:[_epasni])`;
    ruleTemplate.dateunits = `(?:[dDwWmMyY])`;
    ruleTemplate.predefinedoptions = `(?: [ifsIFS]+ )`;
    ruleTemplate.alphacapitalchars = `(?: [uUlLpP]? )`;
    // all Rules including sub-rules
    ruleTemplate.doublestring = `(?:"
									(?:
										(?:
											(?<!\\\\) \\\\"
										)
										|[^"]
									)+" 
								)`;
    ruleTemplate.singlestring = `(?:\'
									(?:
										(?:
											(?<!\\\\)\\\\\'
										)
										|[^\']
									)+\'
								)`;
    ruleTemplate.bracketedexpression = `(?:\\(
											(?:
												(?:
													(?<!\\\\)\\\\\\)
												)
												|[^)]
											)+\\)
										)`;
    ruleTemplate.leadchars = `[0x\\s\\._]`;
    ruleTemplate.delimiterChars = `{{charStartSteps}} {{charStartFormat}} {{charStartRepetition}} {{charStartFrequency}} {{charStartOwnSequence}} {{charStartStopExpression}} $ !`;
    ruleTemplate.delimiter = `(?:\\s*(?:[ {{delimiterChars}} ] | $))`;
    ruleTemplate.sequencedelimiter = `(?:
										\\s*
										_
										(?<seqdelimiter> .{1,2})
									)`;
    ruleTemplate.integer = `(?:[1-9]\\d*|0)`;
    ruleTemplate.pointfloat = `(?: (?: [1-9]\\d*|0 )? \\. (?<startDecimals> \\d+ ) )`;
    ruleTemplate.exponentfloat = `(?:(?:{{integer}} | {{pointfloat}}) [e] [+-]? \\d+)`;
    ruleTemplate.float = `(?:{{pointfloat}} | {{exponentfloat}})`;
    ruleTemplate.hexNum = `(?:0[x](?<hex>0|[1-9a-f][0-9a-f]*))`;
    ruleTemplate.octNum = `(?:0[o](?<oct>0|[1-7][0-7]*))`;
    ruleTemplate.binNum = `(?:0[b](?<bin>[01]+))`;
    ruleTemplate.numeric = `(?:(?<int>{{integer}}) | (?<float>{{float}}))`;
    ruleTemplate.exprtoken = `(?: 
								\\s*\\b
								(?:
									(?: [+-]?
										(?: {{integer}} | {{float}} )
									)
									| {{specialchars}}
								)
								\\b\\s*
							)`;
    ruleTemplate.exproperator = `(?: \\s* (?:\\+|-|\\*|\\/|\\*\\*|mod|div) \\s* )`;
    ruleTemplate.exprcompare = `(?:<=|<|>=|>|===|==)`;
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
											.+?
											| ".+"
											| '.+'
										)
										(?![\\d-])
									)?
									(?: {{sequencedelimiter}} )?
									(?= {{delimiter}} )
								)`;
    ruleTemplate.start_expression = `^(?:
										(?:{{charStartExpr}})
										\\s*
										(?<start>.+?)
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
								(?:
									\\s*
									(?<startseq>
										\\d+
									)?
								)?
								(?: {{sequencedelimiter}} )?
								(?= {{delimiter}} )
							)`;
    ruleTemplate.start_predefined = `^(?: 
								( {{charStartPredefinedSequence}} )
								\\s*
								(?<start_predefined>
									{{doublestring}}
									|
									{{singlestring}}
									|
									\\w+
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
										(?:<length>
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
										(?:
											{{doublestring}}
											| {{singlestring}}
											| {{bracketedexpression}}
											| [^ {{delimiterChars}} ]?
										)
									)?
									(?= {{delimiter}} )
								)`;
    ruleTemplate.frequency = `(?:(?:{{charStartFrequency}}) \\s* (?<freq> \\d+) (?= {{delimiter}} ))`;
    ruleTemplate.repetition = `(?:(?<!{{charStartRepetition}})(?: {{charStartRepetition}}) \\s* (?<repeat> \\d+ ) (?= {{delimiter}} ))`;
    ruleTemplate.startover = `(?:(?:{{charStartStartover}}) \\s* (?<startover> \\d+) (?= {{delimiter}} ))`;
    ruleTemplate.expression = `(?: {{charStartExpression}} \\s* 
								(?<expr>
									{{doublestring}}
									| {{singlestring}}
									| {{bracketedexpression}}
									| [^ {{delimiterChars}} ]?
								)
								(?= {{delimiter}} )
							)`;
    ruleTemplate.stopexpression = `(?: {{charStartStopExpression}} \\s* 
									(?<stopexpr>
										{{doublestring}}
										| {{singlestring}}
										| {{bracketedexpression}}
										| [^ {{delimiterChars}} ]+
									)
									(?= {{delimiter}} )
								)`;
    ruleTemplate.outputSort = `\\$!? $`;
    ruleTemplate.outputReverse = `!\\$? $`;
    for (let [key, value] of Object.entries(ruleTemplate)) {
        while (value.indexOf('{{') > -1) {
            const start = value.indexOf('{{');
            const ende = value.indexOf('}}', start + 2) + 2;
            const replace = value.slice(start, ende);
            const rule = replace.slice(2, replace.length - 2);
            if (rule in ruleTemplate) {
                value = value.replace(replace, ruleTemplate[rule]);
            }
            else {
                value = value.replace(replace, '§NIX§');
            }
        }
        if (key in matchRule) {
            matchRule[key] = value.replace(/\s/gi, '');
        }
    }
    return matchRule;
}
//# sourceMappingURL=extension.js.map