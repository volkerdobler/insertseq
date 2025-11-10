# VS Code Extension: Insert Sequences (InsertSeq)

Insert Sequences is a small VS Code extension that helps you generate and insert all kinds of sequences into one or more cursors. It supports numeric sequences, alphabetic sequences, dates, user-defined or predefined lists, and inline JavaScript expressions. The syntax is compact and powerful, allowing repetition, stepping, frequency, custom formats, stop expressions, and much more.

All inputs are previewed live (as a decoration) for the current selections, so you can verify the generated sequence before pressing Enter.

> # ATTENTION! This is version 1.0 and a big update to previous versions. Read this documentation carfully!

## Usage

## Important news in version 1.0

1. Most important, you now will see the current sequence as **preview/decoration** before pressing `ENTER`.
1. The order of the inserted options are no longer fixed. You can insert the options in any order you like.
1. Beside the (old short and often cryptical) delimiter-chars for the different options, you now can use text-delimiter as an alternative (_steps:_, _freq:_, _repeat:_, _startover:_, _expr:_, _stopif:_, _format:_)
1. Beside predefined lists in your configuration file, you can insert directly a current list to use for this insertion.
1. There is not specific insertations for months (previously starting with `%`). Instead, you now can define your own sequenes and insert all kind of (own) lists - maybe also months (but I would recommend to use dates instead).

## Note regarding the insertion order:

- By default the mapping from sequence items to your cursors depends on the order you created the selections (click order). That order might not match the visual document order (top→bottom).
- Use `$` to force top→bottom (document) insertion order regardless of the click order.
- Use `!` to invert the insertion order. Without `$` that means the click order is reversed; when combined with `$` it results in bottom→top document order.
  See the "Syntax details" section for more information.

## Start extension(s):

You can start the extension either with the command palette and search for `insertseq` or with the (default) key binding `CTRL+ALT+.` (which can be change via configuration [Configuration](#configuration))

If you have already used this extension for a while, you can also use previous insertions with the second command `insertseq.history` (default key binding `CTRL+ALT+,`). With this command, you see all previous insertions and can run them again or edit them to get a new insertion. If you don't have any history entries, the "normal" input box is shown. More details below in the section [History](#history)

# Examples (simple → advanced):

### We start with a multi-cursor selection of 5 lines:

```
|
|
|
|
|
```

When starting the `insertseq`-command, you will see a preview of the numbers 1 to 5 (because, by default, the start-value is the number 1 if no input is typed).

If you start typing the number 3, the preview will change to the number 3 to 7 - and if you press `ENTER` the preview will change to a real insertion of these numbers.

```
3
4
5
6
7
```

### You want to increase the number by another number?

To increase the sequence not by 1 but by any other number (positiv or negative) you can tell the extension the number either by typing `:<number>` or with more descriptive with `step:<number>`. The second alternative has to start with a word boundary, so either a space or comma - **not working** is `10step:2`!.

Example: with the input `10:2` (alternative: `10 step:2`) you get

Output (for 5 selections):

```
10
12
14
16
18
```

### Repeat sequence after a fixed number of insertions

If you want to repeat the sequence after a defined number of insertions, you can do this with the char `#` or the alternative `rep:` (or `repeat:` or `repetition`) input.

Example: `1#5` (step is 1 by default, no need to include it for this sequence)

Output (for 10 selections):

```
1
2
3
4
5
1
2
3
4
5
```

### Repeat each value multiple times

If you want to repeat each insertions multiple times, you can use the `*` char or `freq:` (or `frequency:`) option.

Example: `1 freq:2`

Output (for 10 selections, each value repeated twice):

```
1
1
2
2
3
3
4
4
5
5
```

### Startover

Sometime, you need to start the frequency not at a symetrical point, but anywhere in the sequence. This is the task for `##` or more describable `startover` or alternative `startagain`.

Example: `1 rep:2 freq:3 startover:7` (shorter: 1#2\*3##7)

Output (for 13 selections):

```
1
1
1
2
2
2
1
1         <== start of the sequence from the beginning
1
1
2
2
2
```

### Formatting numbers

The output can be formatted. Internally the d3-format library is used, so a lot of possible formatting can be done.

Example: You want to prefix the output with zeros and want to have a total width for the numbers of 3 `1~03d`

Output (for 5 selections):

```
001
002
003
004
005
```

### Stop expression

Sometime, you want to insert less or more numbers than the current selection.
Both can be done with the char `@` or the alternatives `stopif:` or `stopexpr:` or `stopexpression:`.
This option needs a formular/expression, which has to be `true` to stop the insertion.

You can use special chars in this formular/expression to stop the insertion, whenever you need it. E.g. `i` is the current index of the insertions (starting with 0).

Easy forumlar/expressions can be inserted directly after the column, but I recommend to insert the forumlar/expression in parantisies.

Example: `1 stopif:(i>5)

Output (for 10 selections, the insertion stops if index is 6, which is when the number is 7):

```
1
2
3
4
5
6




```

If the formular/expression is larger than the number of selections, additional lines will be included.

Example: `1 stopif:(i>5)

```
1
```

Output (for 10 selections, the insertion stops if index is 6, which is when the number is 7):

```
1
2
3
4
5
6
```

During the preview/decoration, no new lines are inserted. In this case, you see all future insertions in the last selected line.

### Alpha sequences

Beside numbers, you can insert alphabetic sequences. **Attention:** You can only use chars which are predefined in the "alphabet" you provided in your configuration. And all chars in the alphabet have to be uniq (no double char). If you have not defined your own alphabet, the program uses the default alphabet a-z (upper or lower chars)

Example: `a`

Output (for 5 selections):

```
a
b
c
d
e
```

### Formatting alpha sequences

Like the number formatting, you can also format the output of the alpha sequences.

With the following input you get an output with a width of 5 chars, right-aligned `a~>10`

Output (for 5 selections)

```
         a
         b
         c
         d
         e
```

### Date sequences

Another sequence you can use are dates. The date sequences start with `%`, followed by a date in the form yyyy-mm-dd.
For step counter you can use wither days (default), weeks, months or years.
The output language format can be changed as first part of the `~` option (see example below).

You want to insert every second week, starting with 2nd of March 2026, and want to output the format in a german language format (dd.MM.yyyy):

Input: `%2025-03-02:1w~lang:de`

Output (for 5 selections):

```
2.3.2025
16.3.2025
30.3.2025
13.4.2025
27.4.2025
```

### Expressions

Another flexible way of creating a sequence is to use expressions/formulars.

If you want to insert a sequence, where you double the previous value, you can use:
`|(i>0?p * 2:1)` 
(be aware the previous value is 0 or '' at the beginning! and also it is recommended to use brackets or quotes around any expression)

Output (for 5 selections):

```
1
2
4
8
16
```

### Own lists

If the above sequences don't fit to your needs, you can create your own sequence and insertation will use your list. The list has to start with `[` and should insert either numbers or strings

Example: `["Jan","Feb","Mar"]`

Output (for 5 selections):

```
Jan
Feb
Mar
Jan
Feb
```

### Predefined lists

If you have to insert individual sequences/lists more often, you can predefine them in your configuration.

For example, if you have the configuration entry: `insertseq.ownsequences`

## Syntax Definitions

The expression syntax is compact and built from segments. Each input type has its specific starting marker or format.

General syntax elements (appear in many types):

- start — optional start value. If omitted, the configured default (or `1`) is used.
- :step — optional step/increment.
- \*frequency — number of repetitions for each sequence value before advancing (e.g. `1*3` emits `1,1,1,2,2,2,...`).
- #repeat — repetition / cycle length: how many distinct sequence values are emitted before the sequence restarts (e.g. `1#3` produces `1,2,3,1,2...`).
- ##startover — overall output cycle length: after this many emitted output items the sequence restarts from the beginning, independent of `#` (cycle of distinct values) and `*` (per-value repetitions). Useful to bound the total output pattern.
- ~format — output formatting for numbers, strings or dates (see type-specific details).
- ::expr — inline transformation expression (applies per value).
- @stopexpr — boolean expression evaluated each step to stop early.
- $ force insertion order from top to bottom (document order), independent of the original click order. Use this when you want the sequence assigned in visual top→bottom order.
- ! invert the insertion order. Without `$` this means "reverse click order"; combined with `$` it will insert from bottom→top (the opposite of the `$` top→bottom behavior).

Input Types

1. Decimal / numeric

Syntax: `[<start>[R[+-]<number>]][:<step>][#<repeat>][*<frequency>][##startover][~<format>][::<expr>][@<stopexpr>][$][!]`

- start: numeric start value (default `1`).
    - Note: if the `start` value contains leading characters (for example `00001`), those leading characters will be preserved and used as padding in subsequent values (`00002`, `00003`, ...), unless a different format overrides this behavior.
    - If an `R` follows the start value, a random sequence is produced: numbers are chosen between `start` and `<number>`, or — if a `+` or `-` sign is included — between `start` and `start +/- <number>`.
    - If you want to insert more items than there are selections, you can choose which (max. 2-character) delimiter should be used after an underscore (`_`).
    - If you add `?1` to the input at the end, hexadecimal, octal, and binary numbers will be shown with the prefixes `0x`, `0o`, or `0b`. This can also be achieved with a format string `#x`, `#o`, or `#b`.
- step: numeric step (default `1`).
- repeat: repetition / cycle length — the number of distinct sequence values emitted before the sequence cycles back to the start (e.g. `1#3` → `1,2,3,1,2...`).
- frequency: per-value repetition — how many times each distinct value is emitted before advancing (e.g. `1*3` → `1,1,1,2,2,2,...`).
- format: use `d3-format` formatting strings or simple zero padding like `03d`.
- stop expression: JavaScript expression using `i` (index), `v` (current value) etc.

Examples:

- `5` → inserts `5` at first cursor.
- `1:0.5#4` → `1, 1.5, 2.0, 2.5`.
- `1~04d` → `0001, 0002, ...`.

2. Hex / Octal / Binary

- Start the input as a numeric value using hex/octal/binary notation (prefixes) and use the same numeric syntax.

3. Alpha (strings)

Syntax: `<start>[:<step>][#<repeat>][*<frequency>][##startover][~<format>][::<expr>][@<stopexpr>][$][!]`

- start: a string or single char (e.g. `a` or `A`).
- step: an integer that advances the alphabet by n positions.
- format: alignment and padding options (e.g. `#<10`).

4. Date

Syntax: `%[<year>[-<month>[-<day>]]][:<step>[dwmy]][#<repeat>][*<frequency>][##startover][~<format>][$][!]`

- Step unit: `d` (days), `w` (weeks), `m` (months), `y` (years).
- Format: tokens like `yyyy`, `MM`, `dd`, `HH`, `mm`, `ss`.

Examples:

- `%[2025-01-01]:1d` → 2025-01-01, 2025-01-02, ...
- `%[2025-01]:1m~MMMM yyyy` → January 2025, February 2025, ...

5. Expressions

Syntax: `|<expr>[~<format>][@<stopexpr>][$][!]`

- `<expr>`: a JavaScript expression evaluated per step. Available variables typically include:
    - `i` — zero-based iteration index
    - `v` — current value (if applicable)
    - `N` — number of cursors/selections
    - `s` — original selected text (if any)

Examples:

- `| i * 2` → 0, 2, 4, 6...
- `| (i+1).toString().padStart(3, '0')` → `001, 002, ...`

6. Own / Predefined lists

Syntax: `;name` or an inline array `["a","b","c"]` with optional modifiers like `#` and `##`.

- If using configuration (insertseq.ownsequences) you can reference a named list.
- `##startover` controls the overall output cycle length. Example:

- With expression `1*2#3` (no `##`): the emitted stream is `1,1,2,2,3,3,1,1,2,2,3,3,...` (each value repeated twice, cycle of 3 distinct values).

- If you add `##8` (i.e. `1*2#3##8`), the overall output is grouped in blocks of 8 emitted items before restarting. The emitted stream becomes:

    `1,1,2,2,3,3,1,1,  1,1,2,2,3,3,1,1, ...`

In other words: `##` enforces a total emitted-items period; after that many outputs the sequence restarts from its start, regardless of the internal `#` or `*` settings.

Stopping conditions

- Use `@<stopexpr>` to provide a JavaScript boolean expression evaluated each step. When true, insertion stops.
- Example: `1@i>9` stops after index 9.

History

- The last used expressions are available via `Insert Sequences - History` and can be edited or deleted.

Notes

- Expressions are evaluated in a safe environment (node vm + eval5 fallback for web) where possible. Complex expressions or certain global APIs may not be available in the sandbox.

---

If you want, I can extend the README with screenshots, keybindings, or a quick reference table of tokens and examples. Also I can adjust the exact formatting tokens and examples to match the extension's current behavior if you want me to scan the code and adapt the README precisely to the implementation.

## Configuration

The extension exposes a set of workspace/user settings under the `insertseq` namespace. Below is a quick reference table of available settings, their types and defaults.

| Setting                      |    Type | Default                        | Description                                                                                     |
| ---------------------------- | ------: | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `insertseq.start`            |  string | `"1"`                          | Default start value when none is provided in the input.                                         |
| `insertseq.step`             |  string | `"1"`                          | Default step/increment.                                                                         |
| `insertseq.repetition`       |  string | `""`                           | Default repetition / cycle (`#`) specification.                                                 |
| `insertseq.frequency`        |  string | `"1"`                          | Default per-value repetition (`*`) / frequency.                                                 |
| `insertseq.startover`        |  string | `""`                           | Default overall output cycle (`##`) when set.                                                   |
| `insertseq.stringFormat`     |  string | `""`                           | Default format template for string outputs.                                                     |
| `insertseq.numberFormat`     |  string | `""`                           | Default format template for numeric outputs (uses `d3-format`).                                 |
| `insertseq.dateFormat`       |  string | `""`                           | Default date output format (see README date tokens).                                            |
| `insertseq.alphaCapital`     |  string | `"preserve"`                   | Case handling for alpha sequences: `preserve`, `upper`, `lower`, `pascal`.                      |
| `insertseq.language`         |  string | `""`                           | Default locale/language for month names and date formatting.                                    |
| `insertseq.insertOrder`      |  string | `"cursor"`                     | Default insertion order: `cursor` (click order), `sorted` (top→bottom), `reverse` (bottom→top). |
| `insertseq.century`          |  string | `"20"`                         | Default century for two-digit year inputs.                                                      |
| `insertseq.centerString`     |  string | `"l"`                          | Centering bias for string padding: `l` (left), `r` (right).                                     |
| `insertseq.dateStepUnit`     |  string | `"d"`                          | Default date step unit: `d` (days), `w` (weeks), `m` (months), `y` (years).                     |
| `insertseq.delimiter`        |  string | `""`                           | Delimiter inserted between multiple insertions when appropriate.                                |
| `insertseq.alphabet`         |  string | `"abcdefghijklmnopqrstuvwxyz"` | Alphabet used for alpha sequences.                                                              |
| `insertseq.ownsequences`     |   array | see package.json               | User-defined sequences (array of arrays) available to reference by name.                        |
| `insertseq.radixPrefix`      | boolean | `false`                        | When true, binary/octal/hex numbers are emitted with radix prefixes (`0b`, `0o`, `0x`).         |
| `insertseq.previewColor`     |  string | `"#888888"`                    | Color used for the preview decoration in the editor.                                            |
| `insertseq.maxInsertions`    |  number | `10000`                        | Hard limit on the number of insertions to avoid accidental large operations.                    |
| `insertseq.history.maxItems` |  number | `100`                          | Maximum number of items stored in the history.                                                  |

You can edit these settings in your VS Code settings UI or in `settings.json` under the `insertseq` namespace.

## History: deleting entries and keybindings

You can edit or delete history entries directly from the history QuickPick. When you open the history (Insert Sequences → History), each entry has a small pen icon and trash icon at the right.
Click the pen icon and you can edit this command in the "normal" input box.
Click the trash icon to remove this entry.

There is also a trash icon in the QuickPick toolbar to clear the entire history (it asks for confirmation).

---

## Syntax details:

Syntax for **numbers**:

```

[<start>][:<step>][#<repeat>][*<frequency>][~<format>]r[+]<random>][::<expr>][@<stopexpr>][$][!]

```

with

```

<start> ::= any integer or hex number starting with 0x
<step> ::= any integer (positive or negative) or hex number starting with 0x
<repeat> ::= any positive integer
<frequency>::= any positive integer
<format> ::= [<padding>][<align>][<sign>][#][0] any integer [.<precision>][<type>]
<random> ::= any integer (if a plus-char is available, the number will be added to the <start> number)
<expr> ::= any javascript expression, which can include the special chars (see below)
<stopexpr> ::= any javascript expression, which can include the special chars (see below)
$ ::= the selections will be "sorted" (without this option, new chars will be inserted in the order of the multiline clicks)
! ::= reverts the output

```

---

Formatting can be done with the following options:

```

<padding> ::= any char except }
<align> ::= "<" for left aligned, ">" for right aligned (default), "^" for centered, "=" for right aligned, but with any sign and symbol to the left of any padding
<sign> ::= "-", "+" or " " (blank)

# ::= option causes the “alternate form” to be used for the conversion (see Python documentation)

<precision> ::= any positive number
<type> ::= any one of the following chars "bcdeEfFgGnoxX%"

```

For more details about the formatting possibilities see the [d3-formatting documentation](https://github.com/d3/d3-format#locale_format) or the [Python mini-language documentation](https://docs.python.org/3.4/library/string.html#format-specification-mini-language).

---

Syntax for **alpha**:

```

<start>[:<step>][#<repeat>][\*<frequency>][~<format>][w][@<stopexpr>][$][!]

```

with

```

<start> ::= any Ascii char
<step> ::= any integer (positive or negative)
<repeat> ::= any positive integer
<frequency>::= any positive integer
<format> ::= [<padding>][<align>][<integer>]
w ::= wrap output to one char. E.g. after z, not aa will follow but only a (last char)
<stopexpr> ::= any javascript expression with some special chars, see below
$ ::= the selections will be "sorted" (without this option, new chars will be inserted in the order of the multiline clicks)
! ::= reverts the output

```

---

Formatting can be done with the following options:

```

<padding> ::= any char except }
<align> ::= "<" for left aligned, ">" for right aligned, "^" for centered
<integer> ::= any positive integer (length of the string)

```

---

Syntax for **dates**:

```

%[<year>[-<month>[-<day>]]][:[dwmy]<step>][#<repeat>][*<frequency>][~<format>][$][!]

```

with

```

<year> ::= 2 digit year or 4 digit year
<month> ::= any integer from 1 to 12
<day> ::= any integer from 1 to 31 (note: there is no check for a valid date, e.g. 31.2. is possible)
[dwmy] ::= unit to increment or decrement (_d_ay, _w_eek, _m_onth or _y_ear)
<step> ::= any integer (positive or negative)
<repeat> ::= any positive integer
<frequency>::= any positive integer
<format> ::= any valid date format. Internally, datefns.format is used, so have a look at [datefns documentation](https://date-fns.org/v3.6.0/docs/format)
$ ::= the selections will be "sorted" (without this option, new chars will be inserted in the order of the multiline clicks)
! ::= reverts the output

```

---

Syntax for **month names**:

```

;<start>[:<step>][#<repeat>][\*<frequency>][~<format>][@<stopexpr>][$][!]

```

with

```

<start> ::= any start of a month name or an integer from 1 to 12
<step> ::= any integer (positive or negative)
<repeat> ::= any positive integer
<frequency>::= any positive integer
<format> ::= s(hort)?|l(ong)?
<stopexpr> ::= any javascript expression with some special chars, see below
$ ::= the selections will be "sorted" (without this option, new chars will be inserted in the order of the multiline clicks)
! ::= reverts the output

```

Formatting of month output can be done with the following options:

```

s(hort)? ::= output of month name is an abbreviation (e.g. Feb)
l(ong)? ::= output of the month name is the full name (e.g. February)

```

---

Syntax for **expressions**:

```

[<cast>]|[~<format>::]<expr>[@<stopexpr>][$][!]

```

with

```

<cast> ::= "i", "f", "s", "b"
<format> ::= same as for numbers
<expr> ::= any javascript expression including special chars
<stopexpr> ::= any javascript expression with some special chars, see below
$ ::= the selections will be "sorted" (without this option, new chars will be inserted in the order of the multiline clicks)
! ::= reverts the output

```

_Be aware: You can use the stop expression in expressions, but in contrast to numbers, the stop expression cannot extend the current selection (just stop at last selection). If the stop expression is shorter than the selection, the rest will not be changed. If you want to delete the rest, you have to provide an empty string as return code instead of true for the expression._

The _"cast"_ information for expressions defines the output:

```

i ::= output is an integer
s ::= output is a string (default)
f ::= output is a float number
b ::= output is a boolean

```

---

The following **_special chars_** can be used and will be replaced by some values:

```

\_ ::= current value (before expression or value under current selection)
s ::= value of <step>
n ::= number of selections
p ::= previous value (last inserted)
c ::= current value (only within expressions, includes value after expression)
a ::= value of <start>
i ::= counter, starting with 0 and increasing with each insertion

```

## Release Notes

All release notes are in the Changelog file

## Contributors 🙏

A big thanks to the people that have contributed to improve this project:

- Yu [(@codingyu)](https://github.com/codingyu) &mdash; [contribution](https://github.com/codingyu/insertnums) added first version of history picklist in version 0.5.0

- Jesse Peden [(@JessePeden)](https://github.com/JessePeden) &mdash; [contribution](https://github.com/volkerdobler/insertnums/pull/12) corrected spelling errors in package.json file

- Noah [(@nmay231)](https://github.com/nmay231) &mdash; inspired me to implement the date sequences

## Special thanks!

This project would not be possible without the original Python code [insertnums](https://github.com/jbrooksuk/InsertNums) from James Brooks .
I also used [d3-format](https://github.com/d3/d3-format) from the d3 group and [temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill) for date calculations.

Thanks a lot!
Volker

**Enjoy!**

```

```
