# Change Log

All notable changes to this extension (newest on top):

- 0.10.2

  Changed: Number of leading chars are always the same, even when starting with negative numbers and later inserting positive numbers.

- 0.10.1

  New: underline is a new option for leading characters

  Change: Leading chars can be before any optional negativ sign. After the negativ sign, the numbers are treated like numbers, before, the leading chars will fill the block and negatives are block oriented

  Fixed: leading chars was needed with negativ starting number

- 0.10.0

  New: add new formating - you can now format also with leading zeros, blanks or dots
  New: add support for Date expressions (see Readme, still in alpha, without expr and stop-expression)

  New: two additional configuration variables "insertseq.dateStepUnit" and "insertseq.dateFormat". _dateStepUnit_ defines the default unit (day, week, month or year) for one iteration (default: day) and _dateFormat_ defines the default output format (default: dd.MM.yyyy, validation of output format is not checked, so it is your responsibility to use a valid format-string if you change it)

  Update: new visible command "Insert Sequence" instead of "Insert Numbers"
  Update: delete history insertnums command from package.json

- 0.9.7

  Last minute fix

- 0.9.6

- 0.9.5

  Update: new placeholder text

  Fixed: spelling corrections in package.json file - thanks to @JessePeden

- 0.9.4

  Last minute fix

- 0.9.3

  New: add the possibility to add month with numbers (integers from 1 to 12)

  New: Configuration "insertseq.insertOrder"

  - "cursor" will insert the sequence in the click order; "sorted" will insert the sequence always from the topmost click down.

  Fixed: some minor bugs and stability

  Fixed: some typos in the README.md and CHANGELOG.md

- 0.9.2

  New: (experimental) Starting with a semicolon, the sequenzer assumes a month and will increase month-names. You can format the output with ~l to get long month names.

  Additional: configurations:

  - "insertseq.editHistory": default "false" - if true, all history commands will be editable and changeable before running
  - "insertseq.language" : default to "de" - language for month name output (can be changed with [lang] after a month name)
  - "insertseq.languageFormat" : default to "s" (short version - only first letters of month)

    Fixed: bug in syntax definition of random numbers

- 0.9.1

  Fixed: last minute bug in 0.9.0 :-(

- 0.9.0
  We are getting closer to version 1 ;-)

  New: I have decided to change the command name to "insertseq" because the command does not only insert numbers, but complete sequences (numbers, alpha chars, regular expressions, etc.)

  New: read configuration for default values:

  - "insertseq.start" : default <start> value ("1")
  - "insertseq.step" : default <step> value ("1")
  - "insertseq.cast" : default <cast> value ("s")
  - "insertseq.centerString" : default "left" - value, how to center odd text length in an even length field (l)

  Bugfix: random numbers always started with <start> - fixed to a random number
  Bugfix: expression mode did not work correctly - fixed now to adjust to original ideas from James Brooks

- 0.6.4
  Bugfix: The command did not start

- 0.6.2
  Bugfix: step did not work with decimal numbers - fixed

  Update: minor changes in the README file. Especially formatting had
  some wrong documentation.

- 0.6.1

  Bugfix: showHistory command in package.json was wrong - sorry!

- 0.6.0

  New command: insertnums.showPickHistory (default keyboard shortcut: CTRL+ALT+,)
  The command shows the history of previously typed commands (stored in global). With the new option "insertnums.editHistory" (default: false) you can define if you want to edit the selected command or just run it.

- 0.5.1

  New feature:

  - the output is by default based on the selection order. If you want to include the chars in the order of the editor order (not the click order), the new option '\$' is introduced

- 0.5.0

  New features (all changes by Yu [(@codeyu)](https://github.com/codeyu) - thanks a lot):

  - thanks to Yu [(@codingyu)](https://github.com/codingyu) it's now possible to show the history in an extra window. Start the extension with CTRL+ALT+, (comma is the default key command for command extension.insertNums.showPickHistory), the history will be shown and you can pick one of the previous commands.
  - history is also stored via globalState and can be used after closing vscode
  - new config variable insertNums.historyLimit to limit the number of entries in the history (default: 30)
  - to clear history, you still can use "!c" in the normal inputBox (CTRL+ALT+.).

- 0.4.1
  Updated features:

  - it is now not only possible to print the values in hex, but you can also type hex numbers
    as start value and if you mark a hex number as the first selection, it automatically recognises it
    and print hex numbers.

- 0.4
  New features:

  - new implementation of a random sequence (documentation see README.md)
  - new implementation of a bash-like history function (documentation see README.md)

- 0.3.1
  Fixes:

  - Quick bugfix: the new feature "frequency" was mandatory, not optional. Sorry!
  - Bugfix: inserting upper case letters fixed

- 0.3
  New features:

  - besides the repeat sequence in the previous version, a new frequency option is available with the \*

  Fixes:

  - Bugfix: expression check during runtime

- 0.2
  New features:

  - you can now repeat the sequence with the # option
  - you can use an expressions to get the starting value (first value)

  Improvements:

  - Eliminate typescript errors and smoothen code
  - Improve and extend documentation

- 0.1.1
  Bugfix: expressions will no longer end in an endless loop

- 0.1.0
  Added full formatting for integers and strings.
  Added Expression evaluation.
  Added icon and additional information about the project to package.json

- 0.0.3
  Fixed bug while default step was 0 - is now 1
  Additionally, add first format options - integers and floats can be formatted
  now.

* 0.0.2
  Currently, it's a first running version of InsertNums.
  You will find a command (CTRL-SHIFT P in Windows) "Insert Numbers"

Current feature list (compared to the original Python script - see README file):

- Usage with numbers

  - start and step is supported
  - stopexpr is supported
  - format is _not_ supported at the moment
  - expr is still in _test mode_

- Usage with the alphabet

  - start and step are supported
  - wrap is supported
  - format is _not_ supported at the moment

- Usage with Expressions

  - cast is supported
  - expr is supported
  - stopexpr is supported
  - format is _not_ supported at the moment

- 0.0.1
  Initial upload
