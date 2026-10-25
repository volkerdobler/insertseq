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
7. [Backlog & Geplante Features (v1.4.0)](#8-backlog--geplante-features-für-die-nächste-version)
8. [Empfehlungen & Roadmap für Version 2.0.0](#9-empfehlungen--roadmap-für-version-200)


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

### 8.2 [x] Automatische Multi-Cursor-Platzierung auf allen Überhangzeilen

- **Umgesetztes Verhalten:**
  - Werden mehr Zeilen generiert als ursprünglich Cursors vorhanden waren (`overflowLines.length > 0`), werden nach dem finalen Einfügen (`applyEdit`) automatisch Cursors am Ende **aller** eingefügten Zeilen (Ursprungszeilen + Überhangzeilen) platziert (`parameter.editor.selections`).
  - Mit Unit-Test in `test/history_and_cursor.test.ts` abgesichert (97/97 Tests bestanden).

---

## 9. Empfehlungen & Roadmap für Version 2.0.0

### 9.1 Vollständige Ablösung der RegEx-Engine (`evaluator.ts`) in allen Sequenz-Generatoren & im Validator

- **Aktueller Stand (Branch `v2.0.0`):**
  - Auf `v2.0.0` wurden Lexer (`src/parser/lexer.ts`), AST (`src/parser/ast.ts`) und Recursive-Descent-Parser (`src/parser/parser.ts`) implementiert und in `getInputType()` angebunden.
  - Allerdings wird der erzeugte `SequenceAST` nach `getInputType()` noch verworfen: Die einzelnen Sequenz-Module (`src/sequences/decimal.ts`, `date.ts`, `string.ts`, `ip.ts`, etc.) sowie `src/components/validator.ts` parsen den Eingabestring anschließend noch immer ein zweites Mal über die alten RegEx-Segmente aus `src/components/evaluator.ts` (~520 Zeilen).
- **Ziel für 2.0.0:**
  - [ ] `getSequenceFunction()` übergibt den vom `Parser` erzeugten `SequenceAST` direkt an `createDecimalSeq`, `createDateSeq`, `createStringSeq`, `createIpSeq`, `createUuidSeq`, `createRandomTokenSeq`, `createOwnSeq`, `createPredefinedSeq`, `createFunctionSeq` und `createExpressionSeq`.
  - [ ] Umbau von `src/components/validator.ts`, sodass Syntaxfehler und Spaltenpositionen (`startCol`..`endCol`) direkt aus dem AST-Parser (`ParseError`) bezogen werden, ergänzt um die bestehenden kontextsensitiven Operator-Hinweise während des Tippens.
  - [ ] Vollständiges Entfernen von `src/components/evaluator.ts` sowie `segments: RuleTemplate` aus `TParameter` (`src/types.ts`).

### 9.2 Non-Destructive Preview (Keine vorzeitige Dokument-Modifikation in `initApp`)

- **Problem / Aktuelles Verhalten:**
  - Beim Aufruf eines InsertSeq-Befehls löscht `initApp()` in `src/extension.ts` **sofort** den aktuell markierten Text im Editor mittels `vscode.workspace.applyEdit(edit)` und speichert ihn in `origTextSel` zwischen, um ihn bei `Escape` wieder einzufügen.
  - **Nachteile:**
    - Das Dokument wird bereits beim bloßen Öffnen der InputBox als geändert („Dirty"-Indikator am Tab) markiert.
    - Selbst bei Abbruch mit `Escape` entstehen zwei echte Dokument-Edits (Löschen + Wiederherstellen), die die Undo-Historie (`Ctrl+Z`) des Editors verschmutzen.
- **Ziel für 2.0.0:**
  - [ ] `initApp()` liest `editor.selections` und den selektierten Text nur noch schreibgeschützt aus, ohne das Dokument vorab zu verändern.
  - [ ] Während der Live-Vorschau (`status === 'preview'`) bleibt der Originaltext im Dokument unangetastet; die Vorschau wird über Decorations (`replace` / Ghost-Text) dargestellt.
  - [ ] Erst beim finalen Bestätigen (`status === 'final'` mit `input !== undefined`) wird ein einziges atomares `WorkspaceEdit` auf das Dokument angewandt. Bei `Escape` werden lediglich die Vorschau-Decorations geleert — das Dokument bleibt zu 100 % unberührt.

### 9.3 Bereinigung von Deprecated Settings & Legacy-Code (Breaking Cleanup für Major Release)

- **Ziel für 2.0.0:**
  - [ ] Entfernen der seit Version 1.1.1 als *deprecated* markierten Einstellung `insertseq.insertOrder` aus `package.json` und `src/extension.ts` (vollständig abgelöst durch `insertseq.sortedOutput` und `insertseq.reversedOutput`).
  - [ ] Prüfen und Bereinigen alter Migrationspfade (`migrateOldHistory`), sofern für 2.0.0 nicht mehr benötigt.

### 9.4 Aufwertung der Haupt-InputBox (`createInputBox` mit Schnellzugriff-Buttons)

- **Motivation:**
  - Aktuell nutzt `InsertSeqCommand` `vscode.window.showInputBox()`, was keine eigenen Action-Buttons in der Titelleiste erlaubt.
- **Ziel für 2.0.0:**
  - [ ] Umstellung von `showInputBox` auf `vscode.window.createInputBox()` mit eingebetteten Action-Buttons oben rechts:
    - `$(bookmark)` **Save as Preset:** Speichert den aktuell getippten Sequenz-Ausdruck direkt als Favorit/Preset.
    - `$(wand)` **Switch to Wizard:** Wechselt nahtlos in den interaktiven Sequenz-Assistenten.
    - `$(history)` **History:** Wechselt direkt zur Verlauf-Auswahl.
    - `$(question)` **Syntax Cheat-Sheet:** Öffnet eine kompakte Kurzreferenz (oder Dokumentation) der Operatoren (`:`, `*`, `#`, `##`, `~`, `::`, `@`, `$`, `!`).

### 9.5 Erweiterte Transformationen auf bestehenden Selektionen (Smart Selection Transform)

- **Motivation:**
  - Häufig markieren Nutzer bereits bestehende Zahlen, Versionen oder Daten im Code und möchten diese relativ zu ihrem aktuellen Wert verändern (z. B. alle markierten Zahlen um `+10` erhöhen, neu nummerieren oder formatieren).
  - Zwar existiert in Expressions die Variable `o` (Originaltext, z. B. `|Number(o) + 10`), diese ist aber umständlich zu tippen.
- **Ziel für 2.0.0:**
  - [ ] Kurzsyntax oder direkter Modus für relative Berechnungen auf dem bestehenden Selektionswert `o` (z. B. automatisches Bereitstellen von `num(o)` / numerischem `o` in Ausdrücken oder ein relativer Step-Modus auf bestehenden Zahlen).
  - [ ] Aufnahme von „Transform Selected Text" als eigene Kategorie in den **Wizard** (`insertseq.wizard`) und die Standard-Presets (z. B. *„Add +1 to selected numbers"*, *„Wrap selection in quotes with index"*).

### 9.6 Neue Sequenz- & Generator-Typen (DevOps & Alltag)

- **Optionale Funktions-Erweiterungen für 2.0.0:**
  - [ ] **SemVer-Sequenzen:** Inkrementieren von Versionsnummern nach Semantic Versioning (z. B. `1.2.0:patch` ➔ `1.2.0`, `1.2.1`, `1.2.2`; `1.2.0:minor` ➔ `1.2.0`, `1.3.0`, `1.4.0`).
  - [ ] **IPv6 & MAC-Adress-Sequenzen:** Ergänzend zu IPv4 auch hochzählbare MAC-Adressen (`00:1A:2B:00:00:01:1`) und einfache IPv6-Subnetz-/Host-Sequenzen (`fe80::1:1`).
  - [ ] **Lokalisierte Wochentags- & Monatsnamen (`Intl`):** Direkte Generierung von Wochentagen (`:weekday` / `:dayname`) oder Monaten (`:monthname`) über die native `Intl.DateTimeFormat`-API in der eingestellten Sprache (`de`, `en`, `fr`, `es`, ...) als Kurz- oder Langform (`~s`, `~l`), ohne dass `mysequences` manuell gepflegt werden muss.
  - [ ] **NanoID / ULID Support:** Neben `:uuid` (`v4`/`v7`) auch `:ulid` (lexikografisch sortierbar, kompakt) als Generator-Option.

