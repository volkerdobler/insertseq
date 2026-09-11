# VS Code Extension: Insert Sequences (InsertSeq formerly Insertnums)

Insert Sequences is a small VS Code extension that helps you generate and insert
various kinds of sequences into one or more cursors. It supports numeric sequences,
alphabetic sequences, dates, user-defined or predefined lists, and inline JavaScript expressions.
The syntax is compact and powerful, allowing repetition, stepping, frequency control,
custom formats, stop expressions, and more.

All inputs are previewed live (as a decoration) for the current selections,
so you can verify the generated sequence before pressing Enter.

## Feature Overview (Agenda)

At a glance — what InsertSeq can do:

| Category | Key Capabilities & Quick Examples |
| :--- | :--- |
| **🔢 Numbers & Radices** | • Decimal integers and floating-point numbers (`1`, `0.5`, `-10`)<br>• Radix systems: Hexadecimal (`0x10`), Octal (`0o10`), Binary (`0b10`)<br>• Random number ranges (`1r10` = random numbers between 1 and 10)<br>• Roman numerals: uppercase (`1~R`, `1~roman`) and lowercase (`1~r`) |
| **🔤 Strings & Lists** | • Alphabetic sequences (`a`, `b`, `c`, ...) with case options (`?u`, `?l`, `?p`)<br>• Custom inline lists and circular arrays (`["red","green","blue"]`)<br>• Predefined lists from configuration settings (`;Jan`, `;?1`)<br>• Re-insert or transform previously selected text |
| **📅 Date & Time** | • Calendar dates (`%2025-01-01`, `%now`, `%date:`)<br>• Clock times & timestamps (`%14:00`, `%14:00:15min`)<br>• Compound duration steps (`:1d15min`, `:2h30min`, `:1.5d`)<br>• Format tokens (`yyyy-MM-dd HH:mm:ss`), locales (`lang:de`), and timestamps (`~epoch`, `~epochms`, `~iso`, `~utc`) |
| **🛠️ DevOps & Utilities** | • **UUIDs**: standard v4 (`:uuid`) and time-sortable v7 (`:uuid:v7`), uppercase (`~u`), clean (`~c`)<br>• **Random Tokens & Passwords**: alphanumeric (`:rnd:16`), passwords (`:pwd:16`), hex hashes (`:hex:32`), URL tokens (`:token:24`), PIN codes (`:rnd:6~d`)<br>• **IPv4 Addresses**: host sequences (`192.168.1.1:1`), subnet boundary rollover (`192.168.1.255:1` → `.2.0`), CIDR retention (`10.0.0.1/24:1`), negative steps, binary/hex/int formats (`~bin`, `~hex`, `~int`), and configurable default (`insertseq.ipStart`) |
| **📝 Templates & Wrapping** | • **Quoted templates**: embed sequences into surrounding text (`"Item {}":1` → `Item 1`, `Item 2`)<br>• **Backtick templates**: multiple independent sequences in one line (`` `Row {1}: Col {a}` ``) |
| **⚡ Custom Logic & Functions** | • Inline JavaScript expressions (`|"item_" + (i*2)`)<br>• User-defined reusable functions from configuration settings (`=1`, `=2;5`) |
| **🎛️ Sequence Controls** | • Custom step sizes (`:2`, `:-1`, `step:5`)<br>• Frequency (`*2` / `freq:2` — repeat each value N times)<br>• Repetition (`#5` / `rep:5` — cycle length over values)<br>• Startover (`##10` / `startover:10` — restart stream every N items)<br>• Formatting (`~03d`, `~>10`, padding, alignment)<br>• Stop expressions (`@i>5` / `stopif:(i>5)`)<br>• Document order sorting (`$`) and reverse order (`!`) |
| **💡 Productivity & UX** | • **Live preview decoration** directly in the active editor before pressing Enter<br>• **Command history** (`insertseq.history`, `Ctrl+Alt+,`) to view, repeat, or edit previous insertions<br>• **Presets & Favorites** (`insertseq.presets`, `Ctrl+Alt+P`) to store, name, and execute reusable sequences<br>• **Interactive Wizard / Assistant** (`insertseq.wizard`, `Ctrl+Alt+W`) to assemble sequences step-by-step |

## Usage

See [CHANGELOG.md](./CHANGELOG.md) for all version history and changes from version to version.

### Note about insertion order

- By default, the mapping from sequence items to your cursors follows the order in which you created the selections (click order). That order might not match the document order (top → bottom).
- Use `$` to force top→bottom (document) insertion order regardless of click order.
- Use `!` to invert the insertion order. Without `$`, this reverses the click order; when combined with `$` it results in bottom→top document order.
  See the "Syntax details" section for more information.

### Starting the extension

You can start the extension from the Command Palette by searching for `insertseq`, or use the default key binding `Ctrl+Alt+.` (CTRL-ALT or COMMAND-OPTION + DOT - this can be changed in settings).

If you have used this extension before, you can reuse previous inputs with the command `insertseq.history` (default key binding `Ctrl+Alt+,` CTRL+ALT or COMMAND-OPTION + COMMA). This shows your previous insertions; you can run them again or edit them. If no history entries exist, the normal input box is shown. See the [History](#history) section for details.

To quickly select from predefined or custom saved favorite sequences, use `insertseq.presets` (default key binding `Ctrl+Alt+P` or Command Palette "Insert Sequences: Presets / Favorites"). You can also save any sequence as a named preset with `insertseq.savePreset` or via the star icon (`⭐`) in the History list. See the [Presets / Favorites](#presets--favorites) section for details.

If you don't want to memorize syntax options, use the **Interactive Wizard** with `insertseq.wizard` (default key binding `Ctrl+Alt+W` or Command Palette "Insert Sequences: Wizard"). The wizard guides you step-by-step through choosing a sequence type, start value, increment, and format with live preview in the editor. See the [Wizard / Assistant](#wizard--assistant) section for details.

### Examples (simple → advanced)

#### If you want to see the examples as "live" GIF film [click here](./EXAMPLES.md).

### Decimal sequence (5 cursors)

With five empty cursors, start `insertseq` and you will see a preview of numbers 1 to 5 (the default start is 1).

If you type `3`, the preview updates to 3–7. Pressing Enter inserts those numbers:

```
3
4
5
6
7
```

#### ___Change the step___

Use `:<number>` or `step:<number>` to set the increment. The `step:` form requires a word boundary (space or comma) before it (for example, `10 step:2` works; `10step:2` does not).

Input: `10:2` (or `10 step:2`) with 5 selections → output:

```
10
12
14
16
18
```

#### ___Repeat sequence after a fixed number of insertions___

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

#### ___Repeat each value multiple times (frequency)___

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

#### ___Startover (overall cycle length)___

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

#### ___Formatting numbers___

Formatting uses d3-format style (e.g. `~03d` for zero-padding) or Roman numeral specifiers (`~R` or `~roman` for uppercase Roman numerals, `~r` for lowercase Roman numerals).

Input: `1~03d` with 5 selections → output:

```
001
002
003
004
005
```

Input: `1~R` with 5 selections → output:

```
I
II
III
IV
V
```

Input: `9~r` with 4 selections → output:

```
ix
x
xi
xii
```

#### ___Stop expression___

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

#### ___Formatting alphabetic sequences___

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

### Date and Time sequences

Date and time sequences start with `%` or `date:` followed by a date, time, ISO timestamp, or `now` (e.g. `%2025-03-02`, `%14:00:00`, `%now`).

- **Steps**: Support days (`d`, default), weeks (`w`), months (`m`), years (`y`), hours (`h`), minutes (`min`), seconds (`s` or `sec`), and milliseconds (`ms`).
- **Formatting**: Supports standard tokens (`yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `mm`, `m`, `ss`, `s`), locale fallback strings (e.g. `lang:de`), or special keywords (`~epoch`, `~epochms`, `~iso`, `~utc`).

Input: `%2025-03-02:1w~lang:de` with 5 selections → output:

```text
2.3.2025
16.3.2025
30.3.2025
13.4.2025
27.4.2025
```

Input: `%14:00:15min~yyyy-MM-dd HH:mm:ss` with 3 selections → output:

```text
2026-03-09 14:00:00
2026-03-09 14:15:00
2026-03-09 14:30:00
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

Predefined lists come from your configuration setting (`insertseq.mysequences`). Use the `;` prefix to reference them.

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

### Predefined functions

Predefined functions come from your configuration settings (`insertseq.myfunctions`). Use `=` to reference them, followed by the number (1-based) of the function you want to use.

Given configuration:

```json
"insertseq.myfunctions": [
	"(i, start=1, step=1) => start + (i ** step)",
	"(i) => Math.PI.toString().split('').splice(i,1)"
]
```

Input: `=2` with 5 selections → output:

```
3
.
1
4
1
```

As the function can include `start`, `step`, `repeat`, `frequency` and `startover` (in this order!), the start value is passed via `;`. The other values will come from the options you can provide.

### UUID Sequences

Use :uuid to generate Universally Unique Identifiers (UUIDs). By default, standard v4 UUIDs are generated. You can append :v7 to generate time-sortable v7 UUIDs. Formatting options allow you to convert them to uppercase (~u or ~upper) or remove hyphens (~c or ~clean).

Input: `:uuid` with 3 selections → output:

```text
c5108bb6-52bb-49e0-81f7-e24c538a7c29
f823dc34-97c7-43f1-b9c1-4fc3a23a31c6
1f350c3d-d558-450f-93d3-1e5b10c5b369
```

Input: `:uuid:v7~uc` (Version 7, Uppercase, Clean) with 3 selections → output:

```text
0192A02E7A5A70F88E91910D83A61690
0192A02E7A5B796BA53B621F5A132C1B
0192A02E7A5B79A680C4F7249E34B8C1
```

### Random Tokens, Passwords & Hashes

Generate cryptographically secure random tokens, hexadecimal hashes, and strong passwords:

- `:rnd[:length]` (or `rnd:<length>`): Alphanumeric random string (default length: 16).
- `:hex[:length]` (or `hex:<length>`): Hexadecimal random string (default length: 32).
- `:pwd[:length]` (or `pwd:<length>`): Strong password with uppercase, lowercase, digits, and special characters (default length: 16).
- `:token[:length]` (or `token:<length>`): URL-safe random token (`A-Za-z0-9_-`, default length: 24).
- `:hash[:length]` (or `hash:<length>`): Random hex hash (default length: 32).

**Modifiers (`~` or `?`):**

- `~d` (or `~digits`): Digits only (e.g. `:rnd:6~d` generates 6-digit PIN / OTP codes like `840291`).
- `~u` (or `~upper`): Uppercase only (e.g. `:rnd:12~u` or `:hex:16~u`).
- `~l` (or `~lower`): Lowercase only.
- `~a` (or `~alpha`): Letters only.
- `~s` (or `~special`): Include special characters.

Input: `:rnd:12` with 3 selections → output:

```text
aK9zP2mQx7L1
8dF3vR0bW6yN
5tG8hJ2pM4kL
```

Input: `:rnd:6~d` (6-digit PIN) with 3 selections → output:

```text
492015
837492
109583
```

Input: `:pwd:16` with 2 selections → output:

```text
k#8Mx!2P$qW9@vL4
Z@7p#K1r&vM5!qX8
```

Input: `:hex:16~u` with 2 selections → output:

```text
3F8A1C90B2D4E571
E92D8B10A4C73F62
```

### IPv4 Network & Host Address Sequences

Generate sequential IPv4 network and host addresses with automatic 32-bit subnet boundary rollover and CIDR prefix preservation:

- `192.168.1.1:1`: Increments the host address (`192.168.1.1`, `192.168.1.2`, ...).
- `192.168.1.255:1`: Automatically rolls over subnet octet boundaries into `192.168.2.0`.
- `10.0.0.1/24:1`: Preserves CIDR notation (`10.0.0.1/24`, `10.0.0.2/24`, ...).
- `10.0.1.0:-1`: Negative steps decrement addresses across octet boundaries (`10.0.0.255`).
- `:ip` (or `:ip:1`): Defaults to start address configured via `insertseq.ipStart` (default: `192.168.1.1`).

**Formatting Modifiers (`~` or `format:`):**

- `~0` (or `~pad`): Zero-padded 3-digit octets (`192.168.001.001`). Also automatically enabled when input starts with padded octets.
- `~hex` (or `~x`): 8-character lowercase hexadecimal string (`c0a80101`).
- `~HEX` (or `~X`): 8-character uppercase hexadecimal string (`C0A80101`).
- `~bin` (or `~b`): Dotted 8-bit binary representation (`11000000.10101000.00000001.00000001`).
- `~int` (or `~d`): Unsigned 32-bit integer (`3232235777`).

Input: `192.168.1.254:1` with 3 selections → output:

```text
192.168.1.254
192.168.1.255
192.168.2.0
```

Input: `10.0.0.1/24:1` with 3 selections → output:

```text
10.0.0.1/24
10.0.0.2/24
10.0.0.3/24
```

### Quoted Template

Start with `"` or `'` to embed a sequence inside fixed surrounding text. Write `{}` where the value should appear; the sequence definition follows the closing quote. All standard sequence types and options work as the inner sequence.

Input: `"Item {}":1` with 5 selections → output:

```
Item 1
Item 2
Item 3
Item 4
Item 5
```

Input: `'Result: {}':|(i*i)` with 4 selections → output:

```
Result: 0
Result: 1
Result: 4
Result: 9
```

### Backtick Template

Start with `` ` `` to place the sequence definition directly inside `{…}` blocks within the template. Multiple independent `{…}` blocks are supported in one input — each runs its own sequence.

Input: `` `Row {1} Col {a}` `` with 5 selections → output:

```
Row 1 Col a
Row 2 Col b
Row 3 Col c
Row 4 Col d
Row 5 Col e
```

Input: `` `[{0x0:1}] {a:e}` `` with 4 selections → output:

```
[0x0] a
[0x1] b
[0x2] c
[0x3] d
```

### Tab character (`\t`)

Typing `\t` anywhere in the input inserts a real tab character in the output. This works in all sequence types, template text, inline lists, and expression results. In the live preview, the tab is rendered as a block of non-breaking spaces matching the editor's configured tab width.

Input: `"Col A\tCol B\tCol C"` (single cursor) → output (with tab-separated columns):

```
Col A	Col B	Col C
```

## Content of full syntax description

- [Numbers (Decimal, Hex, Octal, Binary, Roman)](#numeric-sequences-details)
- [Alphabetical / Strings](#alphabetic--string-sequences-details)
- [Dates & Time](#date-and-time-sequences-details)
- [Expressions](#expression-sequences-details)
- [Own Lists](#own-sequences-details)
- [Predefined Lists](#predefined-sequences-details)
- [Functions](#function-sequences-details)
- [UUIDs](#uuid-sequences-details)
- [Random Tokens, Passwords & Hashes](#random-tokens-passwords--hashes-details)
- [IPv4 Addresses](#ipv4-address-sequences-details)
- [Quoted Template](#quoted-template-details)
- [Backtick Template](#backtick-template-details)

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
    - Subparts: padding / lead characters, alignment `< > ^ =`, sign, alternate `#`, width/zero flag, thousands separator `,`, precision `.2`, output type specifier (for example, `b e E o x X %`, `R` or `roman` for uppercase Roman numerals, `r` for lowercase Roman numerals).
    - Examples: `~03d` → zero-padded width 3, `~>8` → right align in width 8, `1~R` → `I, II, III...`, `1~r` → `i, ii, iii...`, `1~>5R` → right-aligned Roman numeral.

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

**Template input modes** (alternative to the start-value approach above):

| Mode              | Trigger                 | Inner sequence                                                |
| ----------------- | ----------------------- | ------------------------------------------------------------- |
| Quoted Template   | `"…"` or `'…'` at start | any sequence type after the closing quote; `{}` = placeholder |
| Backtick Template | `` ` `` at start        | each `{…}` block is an independent sequence definition        |

**Escape sequences in output strings:**

| Escape | Result                                                           |
| ------ | ---------------------------------------------------------------- |
| `\t`   | tab character (preview renders tab width as non-breaking spaces) |

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
- stopexpression
    - Always put the stop expression in parentheses.

Other options (frequency, repeat, startover, expression, sort, reverse) behave the same as for numeric sequences.

Examples:

- `a:1` → a, b, c, ...
- `a:2#3*2` → a,a,c,c,e,e,...
- `x:-1~>4` → right-aligned width 4
- `z~w` → z, a, b, c,...
- `d@(_==="g")` → d, e, f (stops at 'g')

---

### Date and Time sequences details

Most options work like numeric sequences — the parts below differ.

- start
    - Begins with `%` or `date:` followed by a date (`yyyy`, `yyyy-mm`, `yyyy-mm-dd`), time (`HH:mm`, `HH:mm:ss`), full ISO timestamp (`2026-03-09T14:30:00`), `now`, or a quoted/parenthesized date-time string. `%` or `date:` alone uses the current date and time (`now`).
- steps
    - Numeric offset with unit: `d` (days, default), `w` (weeks), `m` (months), `y` (years), `h` (hours), `min` / `minute` / `minutes` (minutes), `s` / `sec` / `second` / `seconds` (seconds), `ms` (milliseconds).
    - Supports **compound duration steps** (for example, `:1d15min`, `:1d2h15m`, `:2h30min`).
    - Supports decimal/fractional steps (for example, `:24.25h`, `:1.5d`).
    - Examples: `%2025-03-02:1w`, `%14:00:15min`, `%14:00:1d15min`, `%now:1h`.
- format
    - Format template using tokens (`yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`, `HH`, `H`, `mm`, `m`, `ss`, `s`), locale fallback (`lang:de`), or special format keywords:
        - `~epoch` / `~timestamp`: Unix timestamp in seconds
        - `~epochms` / `~timestampms`: Unix timestamp in milliseconds
        - `~iso`: ISO-8601 string (`2026-03-09T14:30:00`)
        - `~utc` / `~isoz`: UTC ISO-8601 string (`2026-03-09T14:30:00Z`)
    - Examples: `%2025-03-02~"dd.MM.yyyy"`, `%14:00:15min~"yyyy-MM-dd HH:mm:ss"`, `%now:10s~epoch`.
- stopexpression
    - Always put the stop expression in parentheses.

Notes:

- Date and time arithmetic uses Temporal semantics to handle month lengths, leap years, and accurate time math.
- Placeholders and stopexpr work as in other sequence types.

Examples:

- `%2025-03-02:1w~lang:de`
- `%14:00:15min`
- `%14:00:1d15min`
- `%now:1h~iso`
- `%:7` (start = today)

---

### Expression sequences details

- Start with `|` followed by an expression. The expression is evaluated for each emission. It's recommended to put this expression in quotes
- Does not accept step, repeat, frequency, or startover — implement such behavior inside the expression.
- Format (`~`) and stopexpr (`@`) are allowed.
- Placeholders: `_`, `o`, `c`, `p`, `a`, `s`, `n`, `i`.

Examples:

- `|"(i+1)*10"`
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
    - You can add the following chars before or after the optional index:
        - `i`: The input is case-insensitive, so `;jan` will also find a predefined sequence including `Jan`
        - `f`: The input has to match the complete word in the sequence. For example, `Jan` will not match an item `January`.
        - `s`: Normally, the location of the string is not important. With the `s` option, the input string has to match the beginning of the sequence item.

Examples:

- `;Mar`
- `;?1`
- `;?1|3`
- `;jan?i`

Interaction with other options is the same as for other sequence types.

### Function sequences details

Function sequences let you reference user-defined JS functions configured in `insertseq.myfunctions`. Each configured entry is a JavaScript function expression (typically an arrow function) stored as a string.

Prefixes accepted: `=` (short), `func:`, or `function:` (readable). Functions may be referenced by 1‑based index (e.g. `=1`, `func:2`).

- Typical expected type:
  (i: number, start?: number, step?: number, frequency?: number, repeat?: number, startover?: number) => string | number

- Syntax and options
    - Basic reference: `=1`, `=2`, ...
    - Readable forms: `func:1`, `function:1`, ...
    - Override start value: append `;` and the start value immediately after the function reference — e.g. `=1;5` or `func:2;10`.
    - The following standard sequence options are supported after the function reference and are parsed as for numeric or list sequences:
        - step: `:n` or `step:n`
        - frequency: `*n` or `freq:n`
        - repeat: `#n` or `rep:n`
        - startover: `##n` or `startover:n`
    - Function indexes are 1‑based (first configured function is `=1`). Options after the reference are passed into the function parameters as appropriate.

- Return value and formatting
    - The function must return a string or number. Returned values are inserted verbatim.

- Evaluation and errors
    - Predefined functions are evaluated in a sandbox or a resilient fallback evaluator depending on the host. If evaluation fails for a particular emission, the extension logs the error (when debug is enabled) and emits an empty/undefined insertion for that emission, but continues processing other emissions.

- Tips
    - Keep functions deterministic and side‑effect free.
    - Use parentheses around complex expressions or include parameters via the standard options (`:|step:`, `*|freq:`, `#|repeat:`, `##|startover:`).
    - Use the History command (`insertseq.history`) to quickly reuse or adjust previously working function calls.

---

### UUID Sequences details

Use `:uuid` to generate Universally Unique Identifiers (UUIDs). By default, standard v4 UUIDs are generated. You can append `:v7` to generate time-sortable v7 UUIDs. Formatting options allow you to convert them to uppercase (`~u` or `~upper`) or remove hyphens (`~c` or `~clean`).

Input: `:uuid` with 3 selections → output:

```text
c5108bb6-52bb-49e0-81f7-e24c538a7c29
f823dc34-97c7-43f1-b9c1-4fc3a23a31c6
1f350c3d-d558-450f-93d3-1e5b10c5b369
```

Input: `:uuid:v7~uc` (Version 7, Uppercase, Clean) with 3 selections → output:

```text
0192A02E7A5A70F88E91910D83A61690
0192A02E7A5B796BA53B621F5A132C1B
0192A02E7A5B79A680C4F7249E34B8C1
```

---

### Random Tokens, Passwords & Hashes details

- **Syntax**: `:<type>[:<length>][~<format>]` or `<type>:<length>[~<format>]`
- **Types**:
    - `rnd` / `random`: Alphanumeric random string (default length: 16)
    - `hex`: Random hex string (default length: 32)
    - `pwd` / `password`: Cryptographically secure password with upper, lower, digits, and special characters (default length: 16)
    - `token`: URL-safe token with characters `A-Za-z0-9_-` (default length: 24)
    - `hash`: Random hex hash (default length: 32)
- **Modifiers (`~` or `?`)**:
    - `~d` (digits only) — ideal for PIN and OTP numeric codes
    - `~u` (uppercase only)
    - `~l` (lowercase only)
    - `~a` (letters only)
    - `~s` (include special characters)
- **Standard Sequence Controls**:
    - Frequency (`*n`), repetition (`#n`), startover (`##n`), stop expressions (`@expr`), and expressions (`::expr`) are fully supported.
    - Preserves normal decimal random ranges (e.g. `1r10`) and normal string sequences (e.g. `rnd` or `hex` without colon).

Examples:

- `:rnd:12`
- `:rnd:6~d`
- `:hex:16~u`
- `:pwd:20`
- `:token:32`

---

### IPv4 Address sequences details

- **Syntax**: `[<prefix>][<start_ip>[/<cidr>]][:<step>][*<freq>][#<repeat>][##<startover>][~<format>][::<expr>][@<stopexpr>]`
- **Prefixes (optional)**: `:ip`, `:ipv4`, `ip:`, `ipv4:`. Can be used alone (`:ip:1` starts at the default address configured in `insertseq.ipStart`, default: `192.168.1.1`) or before an address (`:ip:10.0.0.1`).
- **Direct Start**: Any valid IPv4 address (e.g. `192.168.1.1` or `10.0.0.1/24`) is recognized directly without prefix.
- **Arithmetic**:
    - Full 32-bit unsigned arithmetic.
    - Positive and negative increments correctly cross octet boundaries (e.g. `192.168.1.255 + 1` → `192.168.2.0`, `10.0.1.0 - 1` → `10.0.0.255`).
    - CIDR notation (e.g. `/24`) is preserved across increments.
- **Formatting options (`~` or `format:`)**:
    - `~0` / `~pad`: Pad each octet to 3 digits (e.g. `192.168.001.001`). Also enabled automatically when start IP has zero-padded octets.
    - `~hex` / `~x`: 8-digit lowercase hexadecimal representation (`c0a80101`).
    - `~HEX` / `~X`: 8-digit uppercase hexadecimal representation (`C0A80101`).
    - `~bin` / `~b`: Dotted binary representation (`11000000.10101000.00000001.00000001`).
    - `~int` / `~d`: Unsigned 32-bit integer (`3232235777`).
    - Alignment and width templates (e.g. `~<18`) are also supported.
- **Standard Sequence Controls**:
    - Frequency (`*n`), repetition (`#n`), startover (`##n`), expressions (`::expr`), and stop expressions (`@expr`) are fully supported.

Examples:

- `192.168.1.1:1`
- `192.168.1.255:1`
- `10.0.0.1/24:1`
- `10.0.1.0:-1`
- `192.168.1.1~0`
- `192.168.1.1~hex`
- `:ip:1`

### Quoted Template details

`"<template>" <sequence-definition>`
`'<template>' <sequence-definition>`

The input begins with a `"` or `'` character. Everything up to the matching (unescaped) closing quote is the **template string**; everything after it is the **inner sequence definition**.

- `{}` — placeholder: replaced by the value produced by the inner sequence for each emission. Multiple `{}` occurrences per template all receive the same value.
- `\{}` — literal `{}` (not replaced).
- `\"` or `\'` — literal quote character of the same type inside the template.
- The inner sequence definition after the closing quote accepts any valid sequence type (numeric, alpha, date, expression, own, predefined, function) including all modifiers (step, format, repeat, etc.).
- When no inner definition is provided, a plain incrementing decimal sequence starting at 1 is used.

**Examples:**

| Input                    | Output (3 cursors)                                      |
| ------------------------ | ------------------------------------------------------- |
| `"Item {}":1`            | `Item 1`, `Item 2`, `Item 3`                            |
| `'x={}, y={}':a:2`       | `x=a, y=a`, `x=c, y=c`, `x=e, y=e`                      |
| `"Score: {}~03d":0:10`   | `Score: 000`, `Score: 010`, `Score: 020`                |
| `"Step \{fixed\}: {}":1` | `Step {fixed}: 1`, `Step {fixed}: 2`, `Step {fixed}: 3` |
| `"Val: {}": \|(i*i)`     | `Val: 0`, `Val: 1`, `Val: 4`                            |

---

### Backtick Template details

`` `<template>` ``

The input begins with a backtick. Everything up to the matching (unescaped) closing backtick is the **template string** (the closing backtick is optional — if absent the rest of the input is the template).

Each unescaped `{…}` block within the template is an independent **sequence definition**. The blocks are evaluated in parallel: for each emission index `i`, all blocks are advanced simultaneously. The output stops when any block's sequence stops.

- Multiple `{…}` blocks — each has its own sequence type and options.
- `\{` / `\}` — literal `{` / `}` (not treated as a sequence block).
- `` \` `` — literal backtick inside the template.
- `\\` — literal backslash.
- An empty `{}` block defaults to a plain incrementing decimal sequence starting at 1.

**Examples:**

| Input                              | Output (3 cursors)                                |
| ---------------------------------- | ------------------------------------------------- |
| `` `Item {1}` ``                   | `Item 1`, `Item 2`, `Item 3`                      |
| `` `{1} - {a}` ``                  | `1 - a`, `2 - b`, `3 - c`                         |
| `` `Col {0x0:1} Row {1}` ``        | `Col 0x0 Row 1`, `Col 0x1 Row 2`, `Col 0x2 Row 3` |
| `` `\{{1}\}` ``                    | `{1}`, `{2}`, `{3}`                               |
| `` `{%2025-01-01:1m~"MMM"} {1}` `` | `Jan 1`, `Feb 2`, `Mar 3`                         |
| `` `{a}\t{1:5}` ``                 | `a`+Tab+`1`, `b`+Tab+`6`, `c`+Tab+`11`            |

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

## Presets / Favorites

Default keybinding: `Ctrl+Alt+P` / `Cmd+Alt+P` (or Command Palette: "Insert Sequences: Presets / Favorites").

Presets allow you to permanently save, name, and quickly trigger frequently used sequence patterns with a friendly name (e.g. *"Markdown Table Row Index"*, *"Zero-padded 3-digit ID"*, *"IPv4 Local Subnet"*).

### Built-in Presets

Out of the box, InsertSeq comes with several practical presets:
- **Markdown Row Index**: `1:1~<4`
- **Zero-padded 3-digit ID**: `1~03d`
- **IPv4 Local Subnet**: `192.168.1.1:1`
- **UUID v4**: `:uuid`
- **UUID v7 (Time-sortable)**: `:uuid:v7`
- **Secure 16-char Password**: `:pwd:16`
- **Roman Numerals**: `1~R`
- **Daily ISO Dates**: `%now:1d~"yyyy-MM-dd"`

### How to use Presets

- **Open Presets QuickPick**: Press `Ctrl+Alt+P` or run `Insert Sequences: Presets / Favorites`.
- **Live Preview**: Navigating through presets live-previews the sequence at your cursors.
- **Insert**: Press `Enter` to commit the selected preset.
- **Save as Preset**:
  - From History (`Ctrl+Alt+,`): Click the ⭐ star icon next to any history entry to name and save it as a preset.
  - From Presets (`Ctrl+Alt+P`): Select `$(add) New preset` or click the `+` toolbar button.
  - Via Command: Run `Insert Sequences: Save as Preset` from the Command Palette.
- **Edit & Delete**: Each preset item features an edit (✏️) and delete (🗑️) button.
- **Toolbar Actions**:
  - `+`: Add new preset
  - History icon: Jump directly to recent insertion history
  - Trash icon: Clear all presets
  - Discard/Reset icon: Restore default built-in presets

---

## Wizard / Assistant

Default keybinding: `Ctrl+Alt+W` / `Cmd+Alt+W` (or Command Palette: "Insert Sequences: Wizard").

The interactive Wizard guides you step-by-step through generating sequences without needing to remember raw syntax tokens:

1. **Choose Category**:
   - 🔢 **Numbers & Integers**: Decimals, custom step, zero-padding (`001`), roman numerals (`~R`).
   - 🔤 **Letters & Alphabet**: Start letter, step, lowercase/uppercase/pascal casing.
   - 📅 **Date & Time**: Today, time clocks, custom start dates, daily/weekly/hourly step intervals, ISO/locale date formats.
   - 🛠️ **DevOps, UUIDs & Passwords**: UUID v4/v7, random alphanumeric strings, strong passwords, hex hashes, PIN codes, IPv4 subnets.
   - 📋 **Custom List / Words**: Comma-separated items converted to circular arrays.
   - ⚡ **JavaScript Expression**: Formula templates or custom JavaScript expressions.
2. **Interactive Live Preview**:
   - As you navigate options or type values, the editor shows a real-time decoration preview of the sequence across all cursors.
3. **Back-Button Navigation**:
   - Made a mistake? Click the VS Code Back button (`←`) in the top-left of any step to return to the previous option.
4. **Final Options**:
   - 🚀 **Insert Sequence**: Insert immediately into active cursors and record to history.
   - ✏️ **Fine-tune in Input Box**: Transition into the regular input box pre-filled with the wizard's generated sequence.
   - ⭐ **Save as Preset**: Save the generated sequence with a friendly name for recurring use.
   - ❌ **Cancel**: Abort and restore original editor selections.

---

## Configuration

The extension exposes settings under the `insertseq` namespace. A quick reference:

| Setting                       |    Type | Default                        | Description                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------: | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `insertseq.start`             |  string | `"1"`                          | Default start value when none is provided.                                                                                                                                                                                                                                                                                                                                                        |
| `insertseq.step`              |  string | `"1"`                          | Default step/increment.                                                                                                                                                                                                                                                                                                                                                                           |
| `insertseq.repetition`        |  string | `""`                           | Default repetition / cycle (`#`).                                                                                                                                                                                                                                                                                                                                                                 |
| `insertseq.frequency`         |  string | `"1"`                          | Default per-value repetition (`*`).                                                                                                                                                                                                                                                                                                                                                               |
| `insertseq.startover`         |  string | `""`                           | Default overall output cycle (`##`).                                                                                                                                                                                                                                                                                                                                                              |
| `insertseq.stringFormat`      |  string | `""`                           | Default format template for string outputs.                                                                                                                                                                                                                                                                                                                                                       |
| `insertseq.numberFormat`      |  string | `""`                           | Default format template for numeric outputs (d3-format).                                                                                                                                                                                                                                                                                                                                          |
| `insertseq.dateFormat`        |  string | `""`                           | Default date output format.                                                                                                                                                                                                                                                                                                                                                                       |
| `insertseq.ipStart`           |  string | `"192.168.1.1"`                | Default start address for IPv4 sequences if omitted.                                                                                                                                                                                                                                                                                                                                              |
| `insertseq.presets`           |   array | `[]`                           | User-defined sequence presets and favorites (name, sequence, description).                                                                                                                                                                                                                                                                                                                        |
| `insertseq.alphaCapital`      |  string | `"preserve"`                   | Case handling for alpha sequences: `preserve`, `upper`, `lower`, `pascal`.                                                                                                                                                                                                                                                                                                                        |
| `insertseq.language`          |  string | `""`                           | Default locale/language for date formatting.                                                                                                                                                                                                                                                                                                                                                      |
| `insertseq.sortedOuput`       | boolean | `false`                        | Default insertion order: false (default) in multi cursor click order; true in cursor order                                                                                                                                                                                                                                                                                                        |
| `insertseq.reversedOuput`     | boolean | `false`                        | Default insertion order: false (default) in natural order; true: in reverse order                                                                                                                                                                                                                                                                                                                 |
| `insertseq.century`           |  string | `"20"`                         | Default century for two-digit year inputs.                                                                                                                                                                                                                                                                                                                                                        |
| `insertseq.centerString`      |  string | `"l"`                          | Centering bias for string padding: `l` (left), `r` (right).                                                                                                                                                                                                                                                                                                                                       |
| `insertseq.dateStepUnit`      |  string | `"d"`                          | Default date step unit: `d`, `w`, `m`, `y`.                                                                                                                                                                                                                                                                                                                                                       |
| `insertseq.delimiter`         |  string | `""`                           | Delimiter inserted between multiple insertions when appropriate (when empty string, newlines will be inserted).                                                                                                                                                                                                                                                                                   |
| `insertseq.alphabet`          |  string | `"abcdefghijklmnopqrstuvwxyz"` | Alphabet used for alpha sequences.                                                                                                                                                                                                                                                                                                                                                                |
| `insertseq.mysequences`       |   array | see package.json               | User-defined sequences (array of arrays).                                                                                                                                                                                                                                                                                                                                                         |
| `insertseq.myfunctions`       |   array | see package.json               | Own defined Functions (Array of functions) - function arguments are (i, start, step, frequency, repeat, startover), where i is the zero-based index of the insertion, start is the start value, step is the step value, frequency is the frequency value, repeat is the repetition value, and startover is the startover value (all beside i are optional, if you use them, give default values). |
| `insertseq.defaultFunctionNr` |  number | `1`                            | Default function index for myfunctions.                                                                                                                                                                                                                                                                                                                                                           |
| `insertseq.radixPrefix`       | boolean | `false`                        | Emit binary/octal/hex numbers with `0b`, `0o`, `0x` when true.                                                                                                                                                                                                                                                                                                                                    |
| `insertseq.previewColor`      |  string | `"#888888"`                    | Color used for the preview decoration.                                                                                                                                                                                                                                                                                                                                                            |
| `insertseq.maxInsertions`     |  number | `10000`                        | Hard limit on the number of insertions to avoid large operations.                                                                                                                                                                                                                                                                                                                                 |
| `insertseq.maxHistoryItems`   |  number | `100`                          | Maximum number of history items stored.                                                                                                                                                                                                                                                                                                                                                           |
| `insertseq.debug`             | boolean | `false`                        | Enable debug output.                                                                                                                                                                                                                                                                                                                                                                              |

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
