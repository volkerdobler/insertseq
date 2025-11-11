# VS Code Extension: Insert Sequences (InsertSeq formarly Insertnums)

Insert Sequences is a small VS Code extension that helps you generate and insert various kinds of sequences into one or more cursors. It supports numeric sequences, alphabetic sequences, dates, user-defined or predefined lists, and inline JavaScript expressions. The syntax is compact and powerful, allowing repetition, stepping, frequency control, custom formats, stop expressions, and more.

All inputs are previewed live (as a decoration) for the current selections, so you can verify the generated sequence before pressing Enter.

> ATTENTION: This is version 1.0 and a major update to previous versions. Read this documentation carefully!

## Usage

## Important changes in version 1.0

1. Most importantly, you now see the current sequence as a live preview/decoration before pressing Enter.
2. The order of the insertion options is no longer fixed. You can provide the options in any order.
3. In addition to the short delimiter characters used previously, you can now use readable option keywords (for example: `steps:`, `freq:`, `repeat:`, `startover:`, `expr:`, `stopif:`, `format:`).
4. Besides predefined lists in your configuration file, you can provide a list inline for a single insertion.
5. There is no special insertion mode for months anymore (previously starting with `%`). You can define your own sequences and lists (including months), but using date sequences is recommended for calendar data.

## Note about insertion order

- By default, the mapping from sequence items to your cursors follows the order in which you created the selections (click order). That order might not match the document order (top → bottom).
- Use `$` to force top→bottom (document) insertion order regardless of click order.
- Use `!` to invert the insertion order. Without `$`, this reverses the click order; when combined with `$` it results in bottom→top document order.
  See the "Syntax details" section for more information.

## Starting the extension

You can start the extension from the Command Palette by searching for `insertseq`, or use the default key binding Ctrl+Alt+. (this can be changed in settings).

If you have used this extension before, you can reuse previous inputs with the command `insertseq.history` (default key binding Ctrl+Alt+,). This shows your previous insertions; you can run them again or edit them. If no history entries exist, the normal input box is shown. See the [History](#history) section for details.

# Examples (simple → advanced)

### Multi-cursor example (5 cursors)

With five empty cursors, start `insertseq` and you will see a preview of numbers 1 to 5 (the default start is 1).

If you type `3`, the preview updates to 3–7. Pressing Enter inserts those numbers:

```
3
4
5
6
7
```

### Change the step

Use `:<number>` or `step:<number>` to set the increment. The `step:` form requires a word boundary (space or comma) before it (for example, `10 step:2` works; `10step:2` does not).

Input: `10:2` (or `10 step:2`) with 5 selections → output:

```
10
12
14
16
18
```

### Repeat sequence after a fixed number of insertions

Use `#` or `rep:` / `repeat:` / `repetition:` to define the cycle length.

Input: `1#5` with 10 selections → output:

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

### Repeat each value multiple times (frequency)

Use `*` or `freq:` / `frequency:` to repeat each logical value several times.

Input: `1 freq:2` with 10 selections → output:

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

### Startover (overall cycle length)

Use `##` or `startover:` / `startagain:` to restart the entire emitted stream after N emitted items.

Input: `1 rep:2 freq:3 startover:7` (short: `1#2*3##7`) with 13 selections → output:

```
1
1
1
2
2
2
1   <- restart of the sequence
1
1
2
2
2
```

### Formatting numbers

Formatting uses d3-format style. Example: zero-pad to width 3 with `~03d`.

Input: `1~03d` with 5 selections → output:

```
001
002
003
004
005
```

### Stop expression

Use `@` or `stopif:` / `stopexpr:` / `stopexpression:` to stop insertion based on a boolean expression. Use placeholders such as `i` for the current index (0-based).

Input: `1 stopif:(i>5)` with many selections will stop when `i > 5` (when the number would be 7).

During preview no new lines are inserted; the preview shows future insertions on the last selected line.

### Alphabetic sequences

Alpha sequences use the configured alphabet (default `a`–`z`). All characters in the alphabet must be unique. If you have not defined a custom alphabet, the extension uses the default a–z alphabet (case handled by options).

Input: `a` with 5 selections → output:

```
a
b
c
d
e
```

### Formatting alphabetic sequences

String formatting supports padding and alignment. Example: right-align in width 10 with `~>10`.

Input: `a~>10` with 5 selections → output:

```
         a
         b
         c
         d
         e
```

Use `~w` to enable wrap behavior (for example, `z~w` yields `z, a, b, ...` if configured).

### Date sequences

Date sequences start with `%` followed by a date (for example, `yyyy-mm-dd`) or a quoted date string. Steps support days (default), weeks, months, or years. You can specify a language for formatting with `lang:`.

Input: `%2025-03-02:1w~lang:de` with 5 selections → output:

```
2.3.2025
16.3.2025
30.3.2025
13.4.2025
27.4.2025
```

### Expressions

Use the pipe `|` to create a sequence from an inline JavaScript expression. The expression is evaluated for each emission; parentheses or quotes are recommended for clarity.

Input: `|(i>0?p * 2:1)` with 5 selections → output:

```
1
2
4
8
16
```

### Inline lists (Own sequences)

Provide a list inline using square brackets. Items are treated as a circular list.

Input: `["Jan","Feb","Mar"]` with 5 selections → output:

```
Jan
Feb
Mar
Jan
Feb
```

### Predefined lists

Predefined lists come from your configuration setting (for example, `insertseq.mysequences`). Use the `;` prefix to reference them.

Given configuration:

```json
"insertseq.mysequences": [
  ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
  ["foo","bar","foz"]
]
```

Input: `;Mar` with 5 selections → output:

```
Mar
Apr
May
Jun
Jul
```

---

## Content of full syntax description

- [Numbers](#numeric-sequences-details)
- [Alphabetical/Strings](#alphabetic--string-sequences-details)
- [Dates](#date-sequences-details)
- [Own](#own-sequences-details)
- [Predefined](#predefined-sequences-details)

- [History command](#history)

- [Configurations](#configuration)

## Input parts (overview)

The syntax is built from segments. Each input type has a specific starting marker or format. Apart from the start token, the order of options does not matter.

| Name      | Description                        | Delimiters / Aliases                               | Value / Notes                                          |
| --------- | ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------ |
| start     | Start value                        | beginning of input                                 | integer, float, date, string                           |
| step      | Step / increment                   | `:` or `step:`                                     | positive or negative (numeric), integer-only for alpha |
| frequency | Repeat each value                  | `*` or `freq:` / `frequency:`                      | positive integer                                       |
| repeat    | Cycle length of distinct values    | `#` or `rep:` / `repeat:` / `repetition:`          | positive integer                                       |
| startover | Overall emitted-items cycle length | `##` or `startover:` / `startagain:`               | positive integer                                       |
| format    | Output format                      | `~` or `format:`                                   | format string                                          |
| expr      | Inline expression                  | `::` or `expr:` / `expression:`                    | JS expression (recommended in parentheses)             |
| stopexpr  | Stop condition                     | `@` or `stopif:` / `stopexpr:` / `stopexpression:` | JS boolean expression                                  |
| sorting   | Document order                     | `$`                                                | forces top→bottom                                      |
| reverse   | Reverse order                      | `!`                                                | reverses insertion order                               |

---

### Numeric Sequences details

`[<start>[r<random>]][<steps>][<freq>][<repeat>][<startover>][<format>][<expression>][<stopexpression>][$][!]`

- start
    - Initial numeric value. Integer or float. Can include leading zeros for padding (for example, `0001`) or radix prefixes for non-decimal bases.
    - Examples: `1`, `0001`, `+10`, `-5`, `0x1A`.
    - Random option: append `r` with an optional sign and number (for example, `1r10`, `1R+5`).

- steps
    - Numeric step/increment.
    - Syntax: `:<n>` or `step:<n>` / `steps:<n>`.
    - Accepts signed integers or floats.
    - Example: `1:2`, `10 step:-1`.

- frequency
    - How many times each logical value is emitted before advancing.
    - Syntax: `*<n>` or `freq:<n>` / `frequency:<n>`.
    - Example: `1*2` → 1,1,2,2,...

- repeat
    - Cycle length over distinct logical values.
    - Syntax: `#<n>` or `rep:<n>` / `repeat:<n>` / `repetition:<n>`.

- startover
    - Overall emitted-items period; forces the stream to restart after N emitted items.
    - Syntax: `##<n>` or `startover:<n>` / `startagain:<n>`.

- format
    - Formatting template for output values. Uses a compact format compatible with the project's formatting helper (based on d3/mini-Python style).
    - Syntax: `~<format>` or `format:<format>`.
    - Subparts: padding / lead characters, alignment `< > ^ =`, sign, alternate `#`, width/zero flag, thousands separator `,`, precision `.2`, output type specifier (for example, `b e E o x X %`).
    - Examples: `~03d` → zero-padded width 3, `~>8` → right align in width 8.

- expression
    - Inline JavaScript expression that can compute or transform the current value before formatting.
    - Syntax: `::<expr>` or `expr:<expr>` or `expression:<expr>`. It is recommended to quote the expression with `"..."`, `'...'` or parenthesize `( ... )`.
    - Placeholders replaced before evaluation:
        - `_` — current value (before expression)
        - `p` — previous inserted value (`''` for the first value)
        - `a` — start value
        - `s` — step
        - `n` — number of selections
        - `i` — zero-based iteration index
    - Example: `1::(i+1)*10` → outputs `10,20,30,...`.
    - Expressions are evaluated in a sandbox; invalid expressions are ignored and the original value is used.

- stopexpression
    - Boolean JavaScript expression evaluated per emitted item; when true, insertion stops.
    - Syntax: `@<expr>` or `stopif:<expr>` / `stopexpr:<expr>` / `stopexpression:<expr>`.
    - Uses the same placeholders as expressions plus `c` for the current value after expression evaluation.
    - Example: `1@i>9` stops once `i > 9`.
    - If stopexpr evaluates to truthy, insertion stops; invalid or missing stopexpr fall back to stopping when emitted count ≥ number of selections.

- sort / reverse
    - `$` forces insertion order to be document order (top→bottom).
    - `!` reverses insertion order. Combined: `!$` (or `$!`) yields bottom→top document order.

More examples:

- `1:2*2#3##8~03d`
- `0001:1~>6`
- `1::(i+1)*10@i>=4`

---

### Alphabetic / String Sequences details

`[<start>[?u|l|p]][<steps>][<freq>][<repeat>][<startover>][<format>][<expression>][<stopexpression>][$][!]`

- start
    - Start token drawn from the configured `alphabet`. Optional `?u` (upper), `?l` (lower), `?p` (pascal) to adjust case.
- steps
    - Integer steps only (no fractional steps). Negative steps allowed.
- format
    - Padding, alignment, width, wrap flag `w`, and left/right hint `l`/`r`.
    - Examples: `a~>5`, `a~_>3`, `z~w`, `a~10l`.

Other options (frequency, repeat, startover, expression, stopexpr, sort, reverse) behave the same as for numeric sequences.

Examples:

- `a:1` → a, b, c, ...
- `a:2#3*2` → a,a,c,c,e,e,...
- `x:-1~>4` → right-aligned width 4
- `z~w` → z, a, b, c,...

---

### Date sequences details

Most options work like numeric sequences — the parts below differ.

- start
    - Begins with `%` followed by a date part (yyyy, yy, yyyy-mm, yyyy-mm-dd) or a quoted/parenthesized full date string. `%` alone uses today's date.
- steps
    - Numeric offset with optional unit: `d` (days), `w` (weeks), `m` (months), `y` (years). Default unit is days.
    - Examples: `%2025-03-02:1`, `%2025-03-02:1w`, `%2025-03-02:-1m`.
- format
    - Supports optional `lang:` locale and a quoted format or a short token (for example, `iso`).
    - Examples: `%2025-03-02~"dd.MM.yyyy"`, `%2025-03-02~lang:de~"dd.MM.yyyy"`.

Notes:

- Date arithmetic uses Temporal semantics to handle month lengths and leap years.
- Placeholders and stopexpr work as in other sequence types.

Examples:

- `%2025-03-02:1w~lang:de`
- `%:7` (start = today)
- `%2025-01-31:1m`

---

### Expression sequences details

- Start with `|` followed by an expression. The expression is evaluated for each emission.
- Does not accept step, repeat, frequency, or startover — implement such behavior inside the expression.
- Format (`~`) and stopexpr (`@`) are allowed.
- Placeholders: `_`, `o`, `c`, `p`, `a`, `s`, `n`, `i`.

Examples:

- `|(i+1)*10`
- `| "Row-" + (i+1)~>8`
- `| (i%2===0 ? "even" : "odd")@i>=5`

---

### Own sequences details

Inline lists in square brackets are treated as circular/custom lists.

- Syntax: `[item1,item2,...]` or `[item1;item2;...]`.
- Optional numeric start index after the closing `]` (1-based): `[a,b,c]2`.
- Steps must be integers; indexing uses modulo the list length.

Examples:

- `[red,green,blue]` → red, green, blue, red, green
- `[a;b;c] step:2` → a, c, b, a, c, ...
- `[one,two]2` → two, one, two, ...

---

### Predefined sequences details

Predefined sequences are configured under `insertseq.mysequences` and referenced with the `;` prefix.

- Syntax: `;name`, `;"My Seq"`, `;?1` (array index), or `;element`.
- The resolver matches array names or elements and starts accordingly. If no match is found, the identifier is used as a single-item sequence.
    - You can add the following chars before of after the optional index:
        - `i`: The input is case-insensitive, so `;jan` will also find a predefined sequence including `Jan`
        - `f`: The input has to macht the complete word in the sequence. Example `Jan` will not match an item `January`
        - `s`: Normally, the location of the string is not important. With the `s` option, the input string has to match the beginning of the sequence item.

Examples:

- `;Mar`
- `;?1`
- `;?1|3`
- `;jan?i

Interaction with other options is the same as for other sequence types.

---

## History

Default keybinding: Ctrl+Alt+, (also available via the Command Palette as "Insert Sequences - History").

What it shows:

- A QuickPick list of recent inputs (most recent first). Each entry shows the raw input string and a preview.
- The list is limited by the setting `insertseq.maxHistoryItems`.

How to run an entry:

- Select an entry and press Enter to run it again. You receive the live preview before final insertion.

How to edit an entry:

- Use the edit action on a history item to open the input box prefilled with that entry. Edit and press Enter to run.

How to remove entries:

- Use the trash action on an item to delete it, or use the toolbar trash to clear the entire history (confirmation requested).
- Deletions are immediate and cannot be undone via the UI.

Notes:

- History entries store raw input strings only (not generated output). Entries are local to your VS Code profile.
- If no history items exist, the History command falls back to the normal input box.

---

## Configuration

The extension exposes settings under the `insertseq` namespace. A quick reference:

| Setting                     |    Type | Default                        | Description                                                                |
| --------------------------- | ------: | ------------------------------ | -------------------------------------------------------------------------- |
| `insertseq.start`           |  string | `"1"`                          | Default start value when none is provided.                                 |
| `insertseq.step`            |  string | `"1"`                          | Default step/increment.                                                    |
| `insertseq.repetition`      |  string | `""`                           | Default repetition / cycle (`#`).                                          |
| `insertseq.frequency`       |  string | `"1"`                          | Default per-value repetition (`*`).                                        |
| `insertseq.startover`       |  string | `""`                           | Default overall output cycle (`##`).                                       |
| `insertseq.stringFormat`    |  string | `""`                           | Default format template for string outputs.                                |
| `insertseq.numberFormat`    |  string | `""`                           | Default format template for numeric outputs (d3-format).                   |
| `insertseq.dateFormat`      |  string | `""`                           | Default date output format.                                                |
| `insertseq.alphaCapital`    |  string | `"preserve"`                   | Case handling for alpha sequences: `preserve`, `upper`, `lower`, `pascal`. |
| `insertseq.language`        |  string | `""`                           | Default locale/language for date formatting.                               |
| `insertseq.insertOrder`     |  string | `"cursor"`                     | Default insertion order: `cursor`, `sorted`, `reverse`.                    |
| `insertseq.century`         |  string | `"20"`                         | Default century for two-digit year inputs.                                 |
| `insertseq.centerString`    |  string | `"l"`                          | Centering bias for string padding: `l` (left), `r` (right).                |
| `insertseq.dateStepUnit`    |  string | `"d"`                          | Default date step unit: `d`, `w`, `m`, `y`.                                |
| `insertseq.delimiter`       |  string | `""`                           | Delimiter inserted between multiple insertions when appropriate.           |
| `insertseq.alphabet`        |  string | `"abcdefghijklmnopqrstuvwxyz"` | Alphabet used for alpha sequences.                                         |
| `insertseq.mysequences`     |   array | see package.json               | User-defined sequences (array of arrays).                                  |
| `insertseq.radixPrefix`     | boolean | `false`                        | Emit binary/octal/hex numbers with `0b`, `0o`, `0x` when true.             |
| `insertseq.previewColor`    |  string | `"#888888"`                    | Color used for the preview decoration.                                     |
| `insertseq.maxInsertions`   |  number | `10000`                        | Hard limit on the number of insertions to avoid large operations.          |
| `insertseq.maxHistoryItems` |  number | `100`                          | Maximum number of history items stored.                                    |

Edit these settings in the VS Code settings UI or in `settings.json` under the `insertseq` namespace.

---

## Release Notes

See the Changelog file for release notes.

---

## Contributors

Thanks to everyone who contributed:

- Yu [(@codingyu)](https://github.com/codingyu) — added the history picklist (v0.5.0)
- Jesse Peden [(@JessePeden)](https://github.com/JessePeden) — fixed package.json typos
- Noah [(@nmay231)](https://github.com/nmay231) — inspired date sequences

---

## Special thanks

This project builds on ideas from James Brooks' InsertNums (https://github.com/jbrooksuk/InsertNums). Formatting uses d3-format (https://github.com/d3/d3-format) and date calculations use a Temporal polyfill. Thanks also to contributors and to GitHub Copilot for suggestions.

Enjoy!
Volker

**Enjoy!**
