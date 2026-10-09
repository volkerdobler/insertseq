# InsertSeq — Analysebericht: Bugs, Codequalität & Verbesserungsvorschläge

Dieser Bericht dokumentiert alle identifizierten Probleme, logischen Schwachstellen und Randfall-Bugs in der VS Code Extension **InsertSeq** (Version 1.1.1) sowie konkrete Empfehlungen für Erweiterungen und Optimierungen.

---

## Inhaltsverzeichnis

1. [Kritische Bugs (Schweregrad: Hoch)]
2. [Berechnungs-, Logik- und Parsing-Fehler (Schweregrad: Mittel)]
3. [Vorschläge für funktionale Erweiterungen]
4. [Vorschläge für User Experience (UX)]
5. [Vorschläge für Architektur & Testautomatisierung](#6-vorschläge-für-architektur--testautomatisierung)
6. [Empfohlene Roadmap](#7-empfohlene-roadmap)
7. [Backlog & Geplante Features für die nächste Version](#8-backlog--geplante-features-für-die-nächste-version)


---

## 6. Vorschläge für Architektur & Testautomatisierung

_Abschnitte 6.1 (Echte Scope-Variablen in safeEvaluate), 6.2 (Debouncing bei validateInput), 6.3 (Atomare Edits mit vscode.WorkspaceEdit) und 6.4 (Vitest-basiertes Test-Setup) wurden erfolgreich umgesetzt (siehe HISTORY.md)._

### 6.5 Langfristige Migration von RegEx zu einem echten Parser (Lexer / Tokenizer / AST)

- **Problem / Motivation:**
    - Derzeit basiert das Parsing auf über 450 Zeilen verknüpfter Regex-Templates (`evaluator.ts`).
    - Regex-Kaskaden neigen zu subtilen Shadowing-Bugs (z. B. 2-stellige Stundenzahlen, die fälschlicherweise als Jahreszahlen gematcht werden, oder Kollisionen zwischen Alphabet-Strings und neuen Sequenzkürzeln).
    - Keine zeichengenauen Fehlermeldungen: Bei Tippfehlern ignoriert die InputBox die Eingabe meist stillschweigend.
- **Ziel:**
    - Ein deterministischer, handgeschriebener Recursive-Descent-Parser (oder Tokenizer + AST) ohne externe schwere Dependencies, der 100 % abwärtskompatibel zur bestehenden Syntax ist und präzise Fehler anzeigt.

#### Schritt-für-Schritt-Plan zur Parser-Migration:

1. **Phase 1: Vorbereitung & Golden-Master-Test-Suite**
    - [ ] Umfassende Test-Suite aller existierenden Syntax-Kombinationen anlegen (mindestens 100+ Testfälle für Dezimal, Hex, Oktal, Binär, String, Datum/Zeit, Römisch, UUID, RandomToken, Templates, Wiederholungen, Frequenzen, Startover, Expressions und Stop-Expressions).
    - [ ] Formale Grammatik (EBNF) der InsertSeq-Syntax dokumentieren, um alle Rangfolgen und Mehrdeutigkeiten exakt festzuhalten.

2. **Phase 2: Lexer / Tokenizer implementieren (`src/parser/lexer.ts`)**
    - [ ] Zeichenweiser Scanner, der den Eingabestring in diskrete Tokens zerlegt:
        - Literale: `NUMBER`, `STRING_LITERAL`, `IDENTIFIER`
        - Operatoren & Trigger: `COLON`, `STAR`, `HASH`, `DOUBLE_HASH`, `TILDE`, `PIPE`, `EQUAL`, `PERCENT`, `EXCLAMATION`, `DOLLAR`, `AT`
    - [ ] Jeder Token speichert Start- und End-Zeichenposition (`columnStart`, `columnEnd`) für fehlergenaues Feedback.

3. **Phase 3: AST-Definition & Recursive Descent Parser (`src/parser/parser.ts`)**
    - [ ] TypeScript-Typen für den Abstract Syntax Tree (AST) definieren:
        - `SequenceAST`: `kind`, `start`, `step`, `frequency`, `repeat`, `startover`, `format`, `expression`, `stopExpression`, `sorting`, `reverse`
    - [ ] Parser-Funktionen nach dem Recursive-Descent-Prinzip schreiben (`parseSequence()`, `parseStart()`, `parseStep()`, `parseModifiers()`, etc.).
    - [ ] Robuste Fehlerbehandlung mit `ParseException` (inkl. präziser Fehlermeldung und Cursor-Position).

4. **Phase 4: Dual-Parsing & Schattenverifikation**
    - [ ] Test-Harness aufbauen, die bei jedem Testfall parallel den alten RegEx-Evaluator und den neuen AST-Parser ausführt.
    - [ ] Vergleich der generierten Sequenz-Parameter auf 100 %ige Übereinstimmung, bis alle Randfälle abgedeckt sind.

5. **Phase 5: Ablösung der RegEx-Engine**
    - [ ] `getInputType` und `getSequenceFunction` in `src/extension.ts` auf den neuen AST umstellen.
    - [ ] `evaluator.ts` und veraltete Regex-Hilfsfunktionen sicher entfernen.
    - [ ] Bereinigung von totem Code.

6. **Phase 6: Anbindung von Live-Fehlerfeedback (UX)**
    - [ ] Anbindung der Parser-Fehlermeldungen an den `validateInput`-Hook der VS Code `InputBox`.
    - [ ] Zeigt dem Anwender bei Syntaxfehlern direkt an der richtigen Stelle eine verständliche Hilfestellung (z. B. _"Unerwartetes Zeichen an Position 8: Für Zeitschritte bitte Einheit wie 'min' oder 'h' angeben"_).

---

## 7. Empfohlene Roadmap

1. **Sofortmaßnahmen (Bugfixes):** _(Erledigt in v1.1.2)_
    - [x] History-Speicherung reparieren (`if (input !== undefined)`).
    - [x] Datenverlust im History-QuickPick bei Escape/Edit beheben.
    - [x] Cursors und selektierte Texte gemeinsam sortieren (`sortedOutput`).
    - [x] Absturz bei `string.ts` (Index < 0) und `expression.ts` (Undefined Overflow) abfangen.
    - [x] `#`-Füllzeichen in `formatString` aufnehmen und Unit-Test reparieren.
    - [x] Datums-Locale Fallback für `de-DE` korrigieren.

2. **Refactoring (Ausdrucks-Evaluierung & Bereinigung):** _(Erledigt in v1.1.2)_
    - [x] `replaceSpecialChars` durch echte Context-Parameter in `safeEvaluate` ablösen.
    - [x] Totes Code-Material entfernen (`sequence.ts`, `regexBuilder.ts`, ungenutzte Hilfsfunktionen).
    - [x] Linter-Warnungen beheben (`npm run lint`).

3. **Feature-Erweiterungen & UX:**
    - [x] 4.1 UUIDv4/v7-Generator implementieren (`:uuid`, `:v7`).
    - [x] 4.2 Timestamp-/Uhrzeit-Erweiterung für Datumssequenzen (`:15min`, `:1d15min`, `~epoch`, `~iso`).
    - [x] 4.3 Römische Ziffern als Format-Option (`~R`, `~r`, `~roman`).
    - [x] 4.4 Zufalls-Token, Passwörter & Hash-Strings (`:rnd`, `:hex`, `:pwd`, `:token`).
    - [x] 4.5 Netzwerk- & IP-Adressen (`192.168.1.1:1`).
    - [x] 5.1 Presets / Favoriten-Verwaltung hinzufügen (`insertseq.presets`, Schnellzugriff per Menü & Shortcut).
    - [x] 5.2 Interaktiver Sequenz-Builder / Assistent (`insertseq.wizard`).
    - [x] 5.3 Live-Fehlerfeedback & Syntax-Hilfe in der InputBox (`validateSequenceInput`).
    - [x] 5.4 Native Ghost-Text Preview (ohne Flackern, Überhang-Kompaktierung).

4. **Architektur & Testautomatisierung:**
    - [x] 6.1 Echte Scope-Variablen statt Regex-Stringersetzung in `safeEvaluate`.
    - [x] 6.2 Debouncing bei `validateInput` (`insertseq.previewDebounce`).
    - [x] 6.3 Atomare Edits mit `vscode.WorkspaceEdit`.
    - [x] 6.4 Vitest-basiertes Test-Setup einrichten.
    - [x] 6.5 Parser-Migration: Umstellung von RegEx-Kaskaden auf Lexer/Tokenizer + AST-Parser.

---

## 8. Backlog & Geplante Features für die nächste Version

### 8.1 [x] Überhang-Textumbruch bei mehrzeiliger Einfügung (Trailing Line-Content verschieben)

- **Problem / Aktuelles Verhalten:**
  - Steht der Cursor auf einer Zeile mit nachfolgendem Text (z. B. `'abc'` mit Cursor vor `'a'`) und erzeugt eine Sequenz mehr Zeilen als Cursors vorhanden sind (z. B. `1@i>2` ➔ 3 Werte `1`, `2`, `3` bei 1 Cursor), verbleibt der nachfolgende Zeilentext `'abc'` direkt hinter dem ersten Sequenzwert auf Zeile 1:
    ```text
    1abc
    2
    3
    ```
  - Die Überhangzeilen (`2` und `3`) wurden unterhalb der bestehenden Zeile eingefügt (`insertPos = new vscode.Position(lastLine + 1, 0)`), wodurch der Text der Ursprungszeile zerschnitten bzw. unnatürlich oben festgehalten wurde.

- **Umgesetztes Verhalten:**
  - Der dem Cursor nachfolgende Text der Zeile (`abc`) wird hinter die gesamte neu eingefügte Sequenz geschoben (analog zu einem echten Zeilenumbruch mit Einschub):
    ```text
    1
    2
    3
    abc
    ```
  - Steht der Cursor mitten im Text (z. B. `'foo|bar'`), bleibt der Präfix `'foo'` vor der Sequenz und der Suffix `'bar'` wird an das Ende der letzten eingefügten Zeile angehängt:
    ```text
    foo1
    2
    3bar
    ```

- **Wichtige Bedingung & Abgrenzung zu Trennzeichen (Delimiter):**
  - **Nur bei NEWLINE (`delimiter === null`):** Das Verschieben des nachfolgenden Zeilentexts in eine neue Zeile findet **nur** statt, wenn das Einfüge-Trennzeichen ein Zeilenumbruch ist.
  - **Bei horizontalen Trennzeichen (z. B. SPACE, Komma, etc.):** Ist ein Trennzeichen wie Leerzeichen (`1_ :1`), Komma (`1_,:1`) oder ein sonstiger Delimiter gewählt, wird die Sequenz normal an der Cursor-Stelle eingefügt und der nachfolgende Text horizontal nach rechts verschoben:
    - Beispiel: `'foo|bar'` mit `1_ :1@i>2` (SPACE-Delimiter) ➔ `'foo1 2 3 bar'`.

- **Technische Umsetzung & Verifikation:**
  - [x] In `src/extension.ts` (`insertNewSequence`): Bei `delimiter === null` und `overflowLines.length > 0` wird nachfolgender Zeilentext des letzten Cursors erfasst und an das Ende der letzten Überhangzeile verschoben (bzw. auf eine eigene Zeile, falls der Cursor am Zeilenanfang stand).
  - [x] Bei explizitem Delimiter (`delimiter !== null`) bleibt das horizontale Einfügen und Verschieben nach rechts unverändert erhalten.
  - [x] Dedizierte Unit-Tests in `test/history_and_cursor.test.ts` implementiert und verifiziert (96/96 Tests bestanden).
  - [x] TypeScript Typecheck (`check-types`), Linting (`eslint`) und Extension-Builds (`build:desk`, `build:web`) erfolgreich abgeschlossen.
