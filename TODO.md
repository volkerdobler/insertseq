# InsertSeq — Analysebericht: Bugs, Codequalität & Verbesserungsvorschläge

Dieser Bericht dokumentiert alle identifizierten Probleme, logischen Schwachstellen und Randfall-Bugs in der VS Code Extension **InsertSeq** (Version 1.1.1) sowie konkrete Empfehlungen für Erweiterungen und Optimierungen.

---

## Inhaltsverzeichnis

1. [Kritische Bugs (Schweregrad: Hoch)]
2. [Berechnungs-, Logik- und Parsing-Fehler (Schweregrad: Mittel)]
3. [Vorschläge für funktionale Erweiterungen]
4. [Vorschläge für User Experience (UX)](#5-vorschläge-für-user-experience-ux)
5. [Vorschläge für Architektur & Testautomatisierung](#6-vorschläge-für-architektur--testautomatisierung)
6. [Empfohlene Roadmap](#7-empfohlene-roadmap)


---

## 5. Vorschläge für User Experience (UX)

_Alle Punkte aus Abschnitt 5 (5.1, 5.2, 5.3, 5.4) wurden erfolgreich umgesetzt (siehe HISTORY.md)._

---

## 6. Vorschläge für Architektur & Testautomatisierung

### 6.1 Echte Scope-Variablen statt Regex-Stringersetzung in `safeEvaluate`

`safeEvaluate` unterstützt bereits die Übergabe eines `context`-Objekts:

```typescript
safeEvaluate(expr, 1000, {
	_: currentValue, // Zahl oder String je nach Sequenztyp
	i: currentIndex, // 0-basierter Index
	n: selectionCount, // Anzahl Cursors
	s: step, // Schrittweite
	a: start, // Startwert
	p: previousValue, // Vorheriger Wert
	o: origSelectedText, // Selektierter Originaltext
	c: valueAfterExpr, // Wert nach Transformation
});
```

- **Vorteile:**
    - Löst den `'1' + 1 = '110'` Konkatenationsbug vollständig.
    - Verhindert Quote-Syntaxfehler (`don't`).
    - Keine fehlerhaften Ersetzungen in JS-Keywords oder Stringliteralen (`'i = ' + i`).

### 6.2 Debouncing bei `validateInput`

- Bei jedem Tastenanschlag wird die Sequenz derzeit synchron für bis zu 10.000 Iterationen neu berechnet und evaluiert. Ein Debounce von 50–80 ms entlastet die CPU und sorgt für flüssiges Tippen.

### 6.3 Atomare Edits mit `vscode.WorkspaceEdit`

- `editor.edit` kann in Randfällen scheitern, wenn währenddessen Dokument-Events eintreffen. Ein `WorkspaceEdit` fasst alle Änderungen (auch über Cursor-Grenzen hinweg) garantiert in einer einzigen atomaren Undo/Redo-Transaktion zusammen.

### 6.4 Echtes Unit-Test-Framework (Vitest / Mocha)

- Aufbau einer Test-Suite im Verzeichnis `test/`, die alle Sequenzarten automatisiert prüft:
    - Arithmetik (Positive/negative Steps, Floats, Hex, Binär, Oktal)
    - String-Sequenzen (Überlauf z -> aa, Groß-/Kleinschreibung)
    - Datum & Temporal-Formatierung
    - JS-Ausdrücke und Stop-Conditions
    - History-Verhalten und Multi-Cursor-Reihenfolge

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

3. **Feature-Erweiterungen:**
    - [x] 4.1 UUIDv4/v7-Generator implementieren (`:uuid`, `:v7`).
    - [x] 4.2 Timestamp-/Uhrzeit-Erweiterung für Datumssequenzen (`:15min`, `:1d15min`, `~epoch`, `~iso`).
    - [x] 4.3 Römische Ziffern als Format-Option (`~R`, `~r`, `~roman`).
    - [x] 4.4 Zufalls-Token, Passwörter & Hash-Strings (`:rnd`, `:hex`, `:pwd`, `:token`).
    - [x] 4.5 Netzwerk- & IP-Adressen (`192.168.1.1:1`).
    - [ ] 5.1 Presets / Favoriten-Verwaltung hinzufügen.
    - [ ] 6.4 Vitest-basiertes Test-Setup einrichten.

4. **Großes Architektur-Upgrade:**
    - [ ] 6.5 Parser-Migration: Umstellung von RegEx-Kaskaden auf Lexer/Tokenizer + AST-Parser.
