# What's New — Version 1.1.0 (2026-05-16)

## Highlights

- Added Quoted Template mode: start the input with a double-quote `"` or single-quote `'` to embed a sequence inside fixed text. Use `{}` as the placeholder for the sequence value; place the sequence definition after the closing quote. Use `\{}` to include a literal `{}`. If a template contains multiple `{}` placeholders, the same inner sequence will be inserted for each placeholder.

- Added Backtick Template mode: start the input with a backtick `` ` `` to embed sequences directly inside `{…}` blocks within the template text. Multiple `{…}` blocks are supported in a single template — each block contains its own independent sequence definition. Use `\{` / `\}` to include literal braces.

- Added `\t` escape: typing `\t` anywhere in the input (sequence values, template text, inline lists, etc.) inserts a real TAB character. The live preview visualizes tabs using the editor's configured tab width.

## Bugfixes

- Fixed missing output formatting inside expressions.

More details in CHANGELOG.md or README.md

## Examples

### Quoted Template

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

Input: `` `Row {1} Col {a}` `` with 5 selections → output:

```
Row 1 Col a
Row 2 Col b
Row 3 Col c
Row 4 Col d
Row 5 Col e
```

# Happy coding!
