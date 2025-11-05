# insertSeq

Inserts or changes **integers**, **Ascii chars**, **hex numbers**, **month names**, **dates** or any **javascript expressions** in any text file.
It is very helpful if you need to insert sequences or want to change some selected numbers/chars based on a javascript expression.

This extension is based on the wonderful sublimetext extension from James Books (https://github.com/jbrooksuk/InsertNums).

I used this extension intensively in the past within sublime text and I could not find such a flexible extension for VSCode. I rewrote this Python extension in JavaScript and extended it further.

---

## New in 0.10.0

I implemented an easy way to insert date sequences. The start date has to be in the format <year>[-<month>[-<day>]] (e.g. 2024-4-25 for 25th April 2024). Month and day are optional.

Instead of numbers as step, you can decide if you want to add days, weeks, months or years. The format is [:<dwmy>integer]. If you want to add 2 days, you have to type ":d2". If you want to subtract 3 days, use "d-3". The first char has to be the unit (first letter of day, week, month or year).

You can combine date sequences also with frequency and repetitions, but not (in this version) with expressions or stop-expressions!

## Usage:

The extension implements the command "insertSeq" and has a default key binding of `CTRL+ALT+DOT` (or `CMD+ALT+DOT` on Mac). (`DOT` is the period char on the keyboard)

The easiest usage is to insert a sequence of integers, starting with "1" when selecting multiple cursors:

Select multi-cursors

```
|
|
|
|
|
```

Press `CTRL+ALT+DOT` and `RETURN` (Default is to insert numbers, starting with 1)

```
1
2
3
4
5
```

But the standard behavior can be changed anytime, as a pop-up window shows up after pressing `CTRL+ALT+DOT`.

If you want to start with the integer 10 instead of 1, you can do:
`CTRL+ALT+DOT` and type 10 in the pop-up and press `RETURN` and the result will be:

```
10
11
12
13
14
```

If you add a second number in the pop-up windows after a colon ( : ), you define the steps between the integers.

To insert only every 5th integer, starting from 5, you type:
`CTRL+ALT+DOT 5:5 RETURN` and the result will be:

```
5
10
15
20
25
```

You can format the values before including them with **~{FORMAT}** (Definition see below),
e.g. an input "`1~05d`" will get (starting with 1, default step is 1 and format is 5 digits with leading zeros - without the leading zero, blanks will be included):

```
00001
00002
00003
00004
00005
```

The _d_ at the end stands for "decimal" output. If you need the numbers as hex, replace the d with an _x_. If you need the output as octal, put an _o_ at the end and binary numbers can be inserted with a _b_ at the end.

Sometimes, you might need to start the sequence again after a fixed number of repetitions. _(this feature is new and not included in the original sublimetext extension!)_
An example would be if you want to include the numbers 1, 2, and 3 only, and after the 3, it should start from 1 again.
This can be done with the optional **#{REPEATS}**.
Typing `1#3` results in:

```
1
2
3
1
2
```

Another need I often have is to repeat the current char/number a few times before increasing the value. _(this feature is new and not included in the original sublimetext extension!)_
An example would be, if you want to include the numbers 1 three times, then 2 three times, and after this the number 3 three times (so 9 insertions in total).
This can be done with the optional **\*{FREQUENCY}**.
Typing `1*3` when 9 multi selections are marked, results in:

```
1
1
1
2
2
2
3
3
3
```

Another possible need is to add the numbers 1 three times, 5 three times, and so on. Again, if you type `1:4*3` the program will insert 1, 1, 1, then add 4, and insert 5, 5, 5, add 4, and insert digit 9 3 times.

It is also possible to have a stop criterion with the option **@{STOPEXPRESSION}**.
_STOPEXPRESSION_ can be any regular javascript but has the advantage, that some special chars can be used (details in the **SYNTAX** chapter below).

_Example:_ no multi-selection at all
Start (only current cursor):

```
|
```

After typing `1@_>5`, 5 lines will be inserted _(stop if the current value will be greater than 5)_.

```
1
2
3
4
5
```

You can combine all of these options in one command.
With one cursor selected and the following command `3:2*2#4@i>10` results in:

```
3
3
5
5
7
7
9
9
3
3
5
```

The order of the input is also important. By default, the extension inserts the sequence in the order of the click order. Example: first click in line 7, then line 2, and third line 4. After the command `1` the result is (first column shows the line numbers):

```
1:
2: 2
3:
4: 3
5:
6:
7: 1
8:
```

If you want to insert the number from the top down (independent of your click order), you can add the `$` at the end of the command. Same example as above but with the command `1$` results in:

```
1:
2: 1
3:
4: 2
5:
6:
7: 3
8:
```

You can set both behaviors as default with a config-switch `insertOrder`.

It's also possible to reverse the input if you add an `!` at the end of the command.
An example with the same situation (you click in lines 7, 2, and 4) and insert the command `1!`, the result is:

```
1:
2: 2
3:
4: 1
5:
6:
7: 3
8:
```

And in combination with the `$` or the config-switch "insertOrder", it looks like this:

```
1:
2: 3
3:
4: 2
5:
6:
7: 1
8:
```

A special sequence of integers is a random sequence. Insertnums can do this easily with the option **r{UNTIL}** option.
_UNTIL_ is either an integer or a plus-char, followed by an integer. Without a plus-char the integer determines the maximal value in the random range. If a plus-char is used, the _UNTIL_ value will be added to the start value (details syntax see below).

You want to include 5 random numbers between 15 and 25 (including both). Type the following: `15r25` (or alternative `15r+10`).

Example (5 multi-lines are selected):

```
19
16
15
24
24
```

Each time you run this command new random numbers will be created.

Since version 0.9 you can also insert month names (January, February, etc.) or numbers. To do this, you put a semi-colon in front of it and start with a known month name (e.g. oct for October) or an integer from 1 to 12. The `<step>` is also available to skip some months.

Example with a name `;Sep@i>5`:

```
Sep
Oct
Nov
Dec
Jan
Feb
```

Example with an integer `;9@i>5`:

```
Sep
Oct
Nov
Dec
Jan
Feb
```

If you want to change the language, you can provide a valid ISO language within brackets after the month (e.g. `;Sep[en-GB]@i>5`):

```
Sept
Oct
Nov
Dec
Jan
Feb
```

Another sequence are dates (not only months names). To insert dates, you can start the expression with _%_. As step-counter you can decided if \_d_ays, \_w_eeks, \_m_onths or \_y_ears should be added. As example, you want to insert days, starting 25th April 2024, increasing 2 weeks for each step, and output the date in the format <year><month><day>, you can insert `%2005-4-25:w2~yyyyMMdd` and get the following result:

```
20050425
20050509
20050523
20050606
20050620
20050704
```

The same result, as with the month names input can be achieved with this date sequence insertion: `%2005-4:m1~MMM`:

```
Apr
May
Jun
Jul
Aug
Sep
Oct
```

And there is an even more complex feature called "expressions" you can use. Within such an expression, you can use some (internal) "variables". (see [Syntax section](#Syntaxes:))

An example could be to insert numbers depending on the previous selection (double the last value). You can type `CTRL+ALT+DOT 1::p>0?2*p:1` (anything after :: is treated as a javascript expression including the replacement of the internal variables)

```

1
2
4
8
16

```

And because one "variable" within expressions is the `_` (underline) representing the current value under the selection, you can even manipulate the current values.

_Example:_ you select a list of numbers and want to add 50 to each number individually.

Start (all 5 numbers are selected, | shows cursors):

```

1|
2|
3|
4|
5|

```

After typing `::_+50`

```

51
52
53
54
55

```

But _not only numbers_ can be included with this extension. The extension is flexible and can **handle Ascii chars**, so same selection as above but with `CTRL+ALT+DOT a RETURN`

```

a
b
c
d
e

```

or if you want to format the alpha chars left side: `z~<6` (the : just underline the following spaces that are not visible in the document)

```

:z     :
:aa    :
:ab    :
:ac    :
:ad    :

```

And "finally" you can use even more complex **expressions** to insert numbers, floats, strings, or boolean.

An example would be: 5 numbers are selected _(| shows cursors)_:

```

1|
2|
3|
4|
5|

```

With the expression: `|if (i+1<=3) {_+100} else {_+200}`, the result will be:
_(for the first 3 numbers 100 will be added, for all others 200 will be added)_

```

101|
102|
103|
204|
205|

```

---

## Configuration:

Since version 0.9 you can configure the behavior of this extension with configuration variables:

- `insertseq.start` the start value, if no value is provided (default "1")
- `insertseq.step` the step value, if no value is provided (default "1")
- `insertseq.cast` the cast value, if no value is provided (default "s" - only for expression mode)
- `insertseq.centerString` how to center strings if a string is odd and the space is even or vice versa (default "l")
- `insertseq.language` language for month names (default "de" for Germany)
- `insertseq.languageFormat` format of month name output (default "short" - in most languages 3 chars)
- `insertseq.insertOrder` how to insert the values (default "cursor" which inserts the sequence in the click order, alternative: 'sorted')

---

## History:

The history is stored independently of the currently opened workspace in globalStorage of VSCode.

# History command

With the command 'insertseq.showHistory' (default keyboard shortcut is CTRL+ALT+,) you can see the previously typed commands. Select one of them to run this command directly a second time.
Two config items can be used:

## History: deleting entries and keybindings

You can delete history entries directly from the history QuickPick. When you open the history (Insert Sequences → History), each entry has a small trash icon at the right — click it to remove this entry. There is also a trash icon in the QuickPick toolbar to clear the entire history (it asks for confirmation).

If you prefer keyboard shortcuts, you can bind keys to the internal commands that the extension registers. These commands are intentionally not shown in the Command Palette; bind them in your personal Keybindings (Preferences → Keyboard Shortcuts (JSON)). Example entries you can add:

```json
{
  "key": "delete",
  "command": "insertseq._history.deleteActive",
  "when": "inQuickPick"
},
{
  "key": "ctrl+delete",
  "command": "insertseq._history.clearAll",
  "when": "inQuickPick"
}
```

After adding these, pressing DEL while the history QuickPick is focused will delete the currently highlighted entry, and CTRL+DEL will clear the whole history (with confirmation).


- 'insertseq.historyLimit' (default: 30) limit the number of entries in the history. If you don't want to limit the history size, use 0 as unlimited history.
- 'insertseq.editHistory' (default: false) defines if you have to edit/confirm the selected command from the history or just run it directly.
  (special thanks to [(@codeyu)](https://github.com/codeyu) for the first version of the history command).

If you don't find a fitting command in the history, you can choose "new item" and after RETURN you are back in the normal command and can type your new command in the input box.

# Bash-like history

There is a bash-like history for the 'normal' command (input box).

```

!! ::= runs last command (if available)
!<integer> ::= runs the <integer> last command (if available) (!0 and !! are identical)
!p ::= shows the current history in a VSCode output channel.
!c ::= clears current history

```

You can even add some additional commands to this history, but it is not possible to edit the history commands.

Example: if you have run the previous command `10:5` and you would like to add a stop criteria, you can type `!!@i>5` to run the previous command with the new stop criteria (the new command will be `10:5@i>5`).

New commands (including edited commands) will be saved in the history as a new entry.

The number of commands in the bash-like history is not limited, but history will be cleared if the extension or VSCode is reloaded.

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
<day> ::= any integer from 1 to 31 (attention, there is no check for a valid date, e.g. 31.2. is possible!)
[dwmy] ::= unit to increament or decrement (_d_ay, _w_eek, _m_onth or _y_ear)
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
l(ong)? ::= output of the mont name is the full name (e.g. February)

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

## Additional information

For more examples and information, please look at the original extension [here](https://github.com/jbrooksuk/InsertNums).

## Release Notes

All release notes are in the Changelog file

## Contributors 🙏

A big thanks to the people that have contributed to improve this project:

- Yu [(@codingyu)](https://github.com/codingyu) &mdash; [contribution](https://github.com/codingyu/insertnums) added first version of history picklist in version 0.5.0

- Jesse Peden [(@JessePeden)](https://github.com/JessePeden) &mdash; [contribution](https://github.com/volkerdobler/insertnums/pull/12) corrected spelling errors in package.json file

- Noah [(@nmay231)](https://github.com/nmay231) &mdash; inspired me to implement the date sequences

## Special thanks!

This project would not be possible without the original Python code [insertnums](https://github.com/jbrooksuk/InsertNums) from James Brooks .
I also used [d3-format](https://github.com/d3/d3-format) from the d3 group.

Thanks a lot!
Volker

**Enjoy!**

```

```
