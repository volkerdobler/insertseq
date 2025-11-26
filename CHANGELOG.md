# Change Log

All notable changes to this extension (newest first):

# Version 1.0.5

- Added own (predefined) functions (via config files) with the start char "=" or "func[tion]:" - it's similar to expressions, but you can predefine them upfront and use them easily.
- Added readable starter names in addition to start chars (e.g. "predef[ined]seq[uence]:", "own[seq[uence]]:", "date:", "expr[ession]:", "alpha[bet]:" ) - don't forget the colon at the end

- Fixed a bug in the evaluation function (if you want to use the expression option, I recommend putting it at the very end of your input, as some symbols might conflict with other start chars or options, e.g. "\*" used both for frequency and multiplication in expressions)

# Version 1.0.4

- Web version is now working
- New configuration option "debug" for internal use

# Version 1.0.3

- Fixed regular expression to run in Linux environments/containers

# Version 1.0.2

- Removed web version as it did not work (hopefully temporarily until the problem is found)

# Version 1.0.1

- Added activationEvents in package.json for the web version

# Version 1.0.0

This is a brand-new version, completely rewritten from scratch with a major version bump.

The most important changes are:

1. You now see the current sequence as a live preview/decoration before pressing Enter.
2. The order of the insertion options is no longer fixed — you can provide the options in any order.
3. In addition to the short delimiter characters used previously, you can now use readable option keywords (for example: `steps:`, `freq:`, `repeat:`, `startover:`, `expr:`, `stopif:`, `format:`).
4. You can define predefined lists in your configuration file and use them from any starting point in the list.
5. If you only need a special list once or twice, you can provide a list inline for a single insertion (thanks to the history command, you can reuse it multiple times).
6. Several additional configuration options were added (see README.md for a complete list).

Most other commands did not change. 😎

What is missing / no longer available in this version:

- There is no special insertion mode for months anymore (previously starting with `%`). You can define your own sequences and lists (including months), but using date sequences is recommended for calendar data.
- The old "bash-like" history command is gone — use the new `insertseq.history` command, which shows recent insertions and allows editing.

### Commands are described in detail in README.md

---

## Previous version history

- 0.10.2
    - Changed: Number of leading characters is now consistent, even when starting with negative numbers and later inserting positive numbers.

- 0.10.1
    - New: "underline" is a new option for leading characters.
    - Changed: Leading characters can appear before any optional negative sign. After the negative sign, numbers are treated numerically; before it, the leading characters fill the block. Negative numbers are handled in a block-oriented way.
    - Fixed: Leading characters were required when the starting number was negative.

- 0.10.0
    - New: Added new formatting — you can now format with leading zeros, blanks, or dots.
    - New: Added support for date expressions (see README; still in alpha, without expr and stop-expression).
    - New: Two additional configuration variables: `insertseq.dateStepUnit` and `insertseq.dateFormat`.
        - `dateStepUnit` defines the default unit (day, week, month, or year) for one iteration (default: day).
        - `dateFormat` defines the default output format (default: `dd.MM.yyyy`). Validation of the output format is not enforced, so if you change it, ensure you use a valid format string.
    - Update: Visible command renamed to "Insert Sequence" (previously "Insert Numbers").
    - Update: Removed the old history insertnums command from package.json.

- 0.9.7
    - Last-minute fix.

- 0.9.6
    - (no notes)

- 0.9.5
    - Update: New placeholder text.
    - Fixed: Spelling corrections in package.json — thanks to @JessePeden.

- 0.9.4
    - Last-minute fix.

- 0.9.3
    - New: Added the ability to add months using numbers (integers from 1 to 12).
    - New: Configuration `insertseq.insertOrder`:
        - `cursor` will insert the sequence in the click order.
        - `sorted` will always insert the sequence from the topmost selection down.
    - Fixed: Minor bugs and stability issues.
    - Fixed: Some typos in README.md and CHANGELOG.md.

- 0.9.2
    - New (experimental): Starting with a semicolon, the sequencer assumes a month and will increment month names. You can format the output with `~l` to get long month names.
    - Additional configurations:
        - `insertseq.editHistory`: default `false` — if true, history commands are editable before running.
        - `insertseq.language`: default `de` — language for month name output (can be changed with `[lang]` after a month name).
        - `insertseq.languageFormat`: default `s` (short version — only the first letters of the month).
    - Fixed: Bug in the syntax definition of random numbers.

- 0.9.1
    - Fixed: Last-minute bug from 0.9.0.

- 0.9.0
    - New: Command renamed to `insertseq` because the command handles full sequences (numbers, letters, expressions, etc.), not just numbers.
    - New: Read configuration for default values:
        - `insertseq.start` : default start value (`"1"`)
        - `insertseq.step` : default step (`"1"`)
        - `insertseq.cast` : default cast (`"s"`)
        - `insertseq.centerString` : default centering (`l` for left)
    - Bugfix: Random numbers no longer always start at `<start>` — fixed to start randomly.
    - Bugfix: Expression mode issues fixed to match the original ideas from James Brooks.

- 0.6.4
    - Bugfix: The command did not start.

- 0.6.2
    - Bugfix: Step did not work with decimal numbers — fixed.
    - Update: Minor changes in the README file, especially documentation for formatting.

- 0.6.1
    - Bugfix: showHistory command in package.json was incorrect.

- 0.6.0
    - New command: `insertnums.showPickHistory` (default keyboard shortcut: Ctrl+Alt+,)
    - The command shows the history of previously typed commands (stored in global state). With the new option `insertnums.editHistory` (default: false) you can choose whether to edit the selected command before running it.

- 0.5.1
    - New feature: Output is by default based on selection order. Use `$` to force document order (top→bottom).

- 0.5.0
    - New features (all changes by Yu [@codingyu] — thanks):
        - History can be shown in an extra window (default: Ctrl+Alt+,). The history window lets you pick a previous command.
        - History is stored via globalState and persists between VS Code sessions.
        - New config `insertNums.historyLimit` to limit history entries (default: 30).
        - To clear history, you can still use `!c` in the normal input box (Ctrl+Alt\_.).

- 0.4.1
    - Updated: Support for parsing and printing hex numbers improved — hex input is now recognized automatically when applicable.

- 0.4.0
    - New features:
        - New implementation of a random sequence (see README.md).
        - New implementation of a bash-like history function (see README.md).

- 0.3.1
    - Fixes:
        - Quick bugfix: the new "frequency" option was mandatory, but is now optional.
        - Bugfix: inserting uppercase letters fixed.

- 0.3.0
    - New features:
        - In addition to repeat (`#`), a new frequency option (`*`) is available.
    - Fixes:
        - Bugfix: expression checks during runtime.

- 0.2.0
    - New features:
        - You can repeat the sequence with the `#` option.
        - You can use expressions to get the starting value (first value).
    - Improvements:
        - Eliminated TypeScript errors and smoothed code.
        - Improved and extended documentation.

- 0.1.1
    - Bugfix: Expressions will no longer end in an endless loop.

- 0.1.0
    - Added full formatting for integers and strings.
    - Added expression evaluation.
    - Added icon and additional information to package.json.

- 0.0.3
    - Fixed bug where default step was 0 — now defaults to 1.
    - Added initial formatting options for integers and floats.

- 0.0.2
    - First running version of InsertNums.
    - Includes a command (Ctrl+Shift+P in Windows) "Insert Numbers".

Current feature list (compared to the original Python script — see README):

- Usage with numbers
    - start and step supported
    - stopexpr supported
    - format not yet supported in early versions
    - expr in test mode in early versions

- Usage with the alphabet
    - start and step supported
    - wrap supported
    - format not yet supported in early versions

- Usage with expressions
    - cast supported
    - expr supported
    - stopexpr supported
    - format not yet supported in early versions

- 0.0.1
    - Initial upload
