# Insert Sequences (InsertSeq)

Insert Sequences is a small VS Code extension that helps you generate and insert all kinds of sequences into one or more cursors. It supports numeric sequences, alphabetic sequences, dates, user-defined or predefined lists, and inline JavaScript expressions. The syntax is compact and powerful, allowing repetition, stepping, frequency, custom formats, stop expressions, and much more.

All inputs are previewed live (as a decoration) for the current selections, so you can verify the generated sequence before pressing Enter.

## Usage

Basic flow:

You can start the extension either with a normal input box by using the command palette and searching for "insertseq" or by using the (default) key binding `CTRL+ALT+.`.
A second command is a history quick pick command, which can be started by searching for "insertseq.history" or by using the (default) key binding `CTRL+ALT+,`.

More details to the history functionality are described below.

Insertion order note:

- By default the mapping from sequence items to your cursors depends on the order you created the selections (click order). That order might not match the visual document order (top→bottom).
- Use `$` to force top→bottom (document) insertion order regardless of the click order.
- Use `!` to invert the insertion order. Without `$` that means the click order is reversed; when combined with `$` it results in bottom→top document order.
  See the "Syntax details" section for more information.

Examples (simple → advanced):

1. Simple increasing integers

We start a multi-cursor selection of 5 lines:

```
|
|
|
|
|
```

Input: `1`

During the input box is still open, you can see the created sequence as preview (decoration). You can chance the color of the decoration via configuration (see section below)

Output (inserted for 5 selections):

```
1
2
3
4
5
```

![screenshot-placeholder-1](assets/screenshots/example-1.png)

2. Start and step

Input: `10:2`

Output (for 5 selections):

```
10
12
14
16
18
```

![screenshot-placeholder-2](assets/screenshots/example-2.png)

3. Repeat limited times

Input: `1#5` (step is 1 by default, no need to include it for this sequence)

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

![screenshot-placeholder-3](assets/screenshots/example-3.png)

4. Repeat each value multiple times

Input: `1*2`

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

![screenshot-placeholder-4](assets/screenshots/example-4.png)

5. Alpha sequences

Input: `a`

Output (for 5 selections):

```
a
b
c
d
e
```

![screenshot-placeholder-5](assets/screenshots/example-5.png)

6. Formatted numbers

Input: `1~03d`

Output (for 5 selections, 3 digits):

```
001
002
003
004
005
```

![screenshot-placeholder-6](assets/screenshots/example-6.png)

7. Date sequences

Input: `%[2025-01-01]:1d`

Output (for 5 selections):

```
2025-01-01
2025-01-02
2025-01-03
2025-01-04
2025-01-05
```

![screenshot-placeholder-7](assets/screenshots/example-7.png)

8. Date sequence — 2 weeks step

Input: `%[2025-01-01]:2w`

Output (for 5 selections):

```
2025-01-01
2025-01-15
2025-01-29
2025-02-12
2025-02-26
```

![screenshot-placeholder-7b](assets/screenshots/example-7b.png)

9. Expressions

Input: `| i * 2`

Output (for 5 selections):

```
0
2
4
6
8
```

![screenshot-placeholder-8](assets/screenshots/example-8.png)

10. Stop expression

Input: `1@i>5`

Output (for 10 selections; stops when condition is true after 6 outputs):

```
1
2
3
4
5
6




```

![screenshot-placeholder-9](assets/screenshots/example-9.png)

11. Predefined lists

Input: `["Jan","Feb","Mar"]`

Output (for 5 selections, list wraps):

```
Jan
Feb
Mar
Jan
Feb
```

![screenshot-placeholder-10](assets/screenshots/example-10.png)

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
