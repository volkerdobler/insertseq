# InsertSeq — Projektdokumentation für Claude

## Überblick

VS Code Extension zum Einfügen von Sequenzen (Zahlen, Strings, Daten, Ausdrücke u. a.) an Cursor-Positionen.
Basiert auf dem Sublime-Plugin „InsertNums" (James Brooks), komplett neu geschrieben ab November 2025.

- **Publisher:** volkerdobler
- **Extension-ID:** `insertnums` (interner Name), Marktplatz-Name: „Insert Sequences"
- **Aktuelle Version:** 1.0.8
- **Lizenz:** MIT
- **Repository:** https://github.com/volkerdobler/insertseq

---

## Build & Entwicklung

```powershell
npm run compile:desk   # Desktop-Build via tsc (für Debugging)
npm run compile:web    # Web-Build via tsc (identisch mit compile:desk)
npm run compile:all    # clean + compile:desk
npm run build:all      # Produktions-Build via esbuild (Lint + Minify, nur Desktop)
npm run check-types    # TypeScript-Typprüfung ohne Ausgabe
npm run lint           # ESLint über src/
npm run watch:all      # Dateiüberwachung (tsc watch)
```

- **Debug-Build:** `tsc -p ./` → einzelne JS-Dateien in `dist/` (1:1 pro `.ts`-Datei, Breakpoints funktionieren)
- **Produktions-Build:** esbuild (`esbuild.js`) → `dist/extension.js` als Bundle (Lint + Minify)
- **TypeScript:** `tsconfig.json` im Wurzelverzeichnis
- **Ausgabe:** `dist/extension.js` (sowohl `main` als auch `browser`-Feld in `package.json`)
- **Formatter:** Prettier (über ESLint-Plugin) — läuft automatisch beim Speichern

**Debugging (VS Code):**
- `Local Debug Extension` → preLaunchTask: `compile:desk` (tsc), dann Extension Development Host
- `Web Debug Extension` → preLaunchTask: `compile:web` (tsc), dann Web Worker Host
- Breakpoints in `.ts`-Dateien werden korrekt aufgelöst (tsc erzeugt 1:1-Sourcemaps)

---

## Dateistruktur

```
src/
  extension.ts          Einstiegspunkt, Command-Handler, Insertion-Engine,
                        createTemplateSeq, createBacktickTemplateSeq
  types.ts              Alle gemeinsamen Typen (TInput, TParameter, …)
  formatting.ts         Zahlen-/String-/Datumsformatierung
  sequence.ts           generateSequence() — reine Zahlenfolge-Util
  regexBuilder.ts       (Hilfsdatei, kein Produktionscode)
  decoration_example.ts Referenzbeispiel (nicht in Produktion genutzt)
  formatting.test.ts    Tests für formatting.ts
  components/
    evaluator.ts        Aufbau aller Regex-Segmente (getRegExpressions)
    utils.ts            Hilfsfunktionen (Parsing, Ausdruck-Evaluierung, …)
    history.ts          Persistenz der Eingabe-History (globalState)
    safeEval.ts         Sandbox-Evaluierung (Node vm → eval5 → new Function)
    safeEval.d.ts       Typ-Deklaration für safeEval
  sequences/
    decimal.ts          Zahlensequenzen (dez/hex/okt/bin)
    string.ts           Alphabetische Sequenzen
    date.ts             Datumssequenzen (Temporal API)
    expression.ts       JavaScript-Ausdrucks-Sequenzen
    own.ts              Inline-Listensequenzen ([rot,grün,blau])
    predefined.ts       Sequenzen aus mysequences-Konfiguration
    function.ts         Sequenzen aus myfunctions-Konfiguration
    textSelected.ts     Wiederholung des selektierten Textes
```

---

## Architektur

### Ablauf einer Einfügung

1. **`initApp`** — liest Config, kompiliert Regex-Segmente, löscht selektierten Text, merkt Cursorpositionen
2. **`InsertSeqCommand`** — zeigt InputBox, ruft `insertNewSequence` live im `validateInput`-Hook auf (Preview)
3. **`getInputType`** — bestimmt Sequenztyp anhand des ersten Zeichens der Eingabe
4. **`getSequenceFunction`** — instanziiert die passende `createXxxSeq`-Funktion
5. **`insertNewSequence`** — iteriert über Indizes bis `stopFunction=true`, dann Preview (Decorations) oder Final (edit)

### Jede `createXxxSeq`-Funktion

Gibt eine Closure `(i: number) => { stringFunction: string; stopFunction: boolean }` zurück.
- `i` = nullbasierter Einfüge-Index
- `stopFunction = true` → Iteration wird abgebrochen
- Standard-Stop: `i >= origCursorPos.length` (eine Sequenz pro Cursor)

### Regex-Segmente (`components/evaluator.ts`)

`getRegExpressions()` baut ein Dictionary aus Template-Strings, die sich gegenseitig via `{{key}}`-Platzhalter referenzieren. Nach vollständiger Auflösung werden Leerzeichen entfernt. Nur Keys, die im `matchRule`-Objekt vorhanden sind, werden exportiert.

### Ausdruck-Evaluierung (`components/safeEval.ts`)

Dreistufiger Fallback:
1. Node.js `vm`-Modul (Desktop)
2. `eval5`-Bibliothek (Browser/gebündelt)
3. `new Function` / `window.eval` (Browser-Fallback)

---

## Eingabe-Syntax (Kurzreferenz)

| Typ | Präfix | Beispiel |
|-----|--------|---------|
| Dezimal | Ziffer oder `+-` | `1:2#3` |
| Hex | `0x` | `0xFF:1` |
| Oktal | `0o` | `0o7:1` |
| Binär | `0b` | `0b1010` |
| Alphabetisch | Buchstabe | `a:2` |
| Datum | `%` oder `date:` | `%2025-01-01:1w` |
| Ausdruck | `\|` oder `expr:` | `\|i*i` |
| Eigene Liste | `[` oder `ownseq:` | `[rot,grün,blau]` |
| Vordefiniert | `;` oder `predefined:` | `;Jan` |
| Funktion | `=` oder `function:` | `=1` |
| Quoted Template | `"` oder `'` | `"Item {}":1:5` |
| Backtick Template | `` ` `` | `` `Row {a:e}:` `` |

**Gemeinsame Modifikatoren** (alle Typen):

| Syntax | Bedeutung |
|--------|-----------|
| `:<step>` | Schrittweite |
| `#<n>` | Wiederholung (repeat) |
| `*<n>` | Frequenz (jeder Wert n-mal) |
| `##<n>` | Startover (Neustart alle n Werte) |
| `~<format>` | Ausgabeformat |
| `::<expr>` | Ausdruck zur Wertveränderung |
| `@<stopexpr>` | Stop-Bedingung |
| `$` | Ausgabe sortiert (top→bottom) |
| `!` | Ausgabe umgekehrt |

**Token in Ausdrücken:**

| Token | Bedeutung |
|-------|-----------|
| `_` | aktueller Wert (vor Expression) |
| `c` | aktueller Wert (nach Expression) |
| `p` | vorheriger Wert |
| `o` | originaler selektierter Text |
| `a` | Startwert |
| `s` | Schrittweite |
| `n` | Anzahl Cursor-Positionen |
| `i` | nullbasierter Index |

### Template-Syntax

**Quoted Template** (`"..."` oder `'...'`):
```
"Hallo {}":1:5    →  Hallo 1, Hallo 2, …, Hallo 5
'Item {}':a:e     →  Item a, Item b, …, Item e
```
- `{}` = Platzhalter für den Sequenzwert
- Sequenz-Definition folgt nach dem schließenden Anführungszeichen
- `\{}` = literale geschweifte Klammern

**Backtick Template** (`` `...` ``):
```
`Hallo {1:5}`     →  Hallo 1, Hallo 2, …, Hallo 5
`Row {a:e}:`      →  Row a:, Row b:, …, Row e:
`Preis \{fix\}: {10:5:100}` → Preis {fix}: 10, Preis {fix}: 15, …
```
- Sequenz-Definition steht direkt **innerhalb** von `{…}`
- Mehrere `{…}`-Blöcke möglich — jeder Block hat eine eigene Sequenz-Definition
- Stop, sobald eine der Sequenzen stoppt
- `\{` / `\}` = literale geschweifte Klammern; `` \` `` = literaler Backtick

---

## Konfiguration (`package.json` → `contributes.configuration`)

| Key | Default | Bedeutung |
|-----|---------|-----------|
| `start` | `"1"` | Standard-Startwert |
| `step` | `"1"` | Standard-Schrittweite |
| `repetition` | `""` | Standard-Wiederholung |
| `frequency` | `"1"` | Standard-Frequenz |
| `startover` | `""` | Standard-Startover |
| `numberFormat` | `""` | d3-Format für Zahlen |
| `stringFormat` | `""` | Format für Strings |
| `dateFormat` | `""` | Format für Daten |
| `dateStepUnit` | `"d"` | Einheit für Datum-Schritte (`d/w/m/y`) |
| `alphaCapital` | `"preserve"` | Groß-/Kleinschreibung (`preserve/upper/lower/pascal`) |
| `language` | `""` | BCP-47-Locale für Datumsausgabe |
| `insertOrder` | `"cursor"` | Einfüge-Reihenfolge (`cursor/sorted/reverse`) |
| `century` | `"20"` | Jahrhundert für 2-stellige Jahreszahlen |
| `centerString` | `"l"` | Zentrierung Bias (`l/r`) |
| `delimiter` | `""` | Trennzeichen für Überschuss-Einfügungen |
| `alphabet` | `"abcde…z"` | Alphabet für String-Sequenzen |
| `mysequences` | `[[…]]` | Eigene Listensequenzen (Array von Arrays) |
| `myfunctions` | `[…]` | Eigene Funktionen (Arrow-Function-Strings) |
| `defaultFunctionNr` | `1` | Standard-Funktionsnummer |
| `radixPrefix` | `false` | `0x`/`0o`/`0b`-Präfix bei Nicht-Dezimal |
| `previewColor` | `"#888888"` | Farbe der Preview-Dekorationen |
| `previewStatus` | `true` | Preview ein/aus |
| `maxInsertions` | `10000` | Maximale Anzahl Einfügungen pro Aufruf |
| `maxHistoryItems` | `100` | Maximale History-Einträge |
| `debug` | `false` | Debug-Ausgabe im Output-Channel |

---

## Bekannte Fehler — behoben

| # | Datei | Beschreibung |
|---|-------|-------------|
| 1 | `date.ts:70` | Config-Key `date_unit` → `dateStepUnit` (Datum-Schritteinheit wurde nie gelesen) |
| 2 | Mehrere | Off-by-one: `i <= origTextSel.length` → `i < origTextSel.length` (undefined im Ausdruck) |
| 3 | `utils.ts:26` | Debug-Modus ließ sich nicht deaktivieren (`\|\|`-Zuweisung → direkte Zuweisung) |
| 4 | `extension.ts` | Non-breaking Spaces (` `) wurden in den finalen Dokument-Text geschrieben |
| 5 | `extension.ts` | Überschüssige Zeilen wurden alle an derselben Position eingefügt (falsche Reihenfolge) → `overflowLines`-Array + einzelner Insert |

**Noch offen:**
- `own.ts`: `expr` (Expression für eigene Listen) wird extrahiert aber nie angewendet
- `own.ts`, `predefined.ts`: Negativer Step kann negativen Array-Index erzeugen → Fix: `((idx % len) + len) % len`

---

## Technische Hinweise

- `decoration_example.ts` ist eine Referenzimplementierung, **nicht** Teil des Produktionscodes
- `formatDateStr` in `formatting.ts` ist toter Code (`@deprecated`) — die Datum-Sequenz nutzt `formatTemporalDateTime`
- `start_alpha` im Regex-Template verwendet `\u0` als Platzhalter, der in `string.ts` durch die Alphabet-Zeichen ersetzt wird; die parallele Ersetzung in `extension.ts` (`\w`) ist wirkungslos (toter Code)
- Die `safeEval`-Sandbox verhindert gefährliche Auswertungen; im Web-Modus fällt sie auf `new Function` zurück
- History wird in `globalState` unter dem Key `insertseq.history` gespeichert; Migration aus dem alten Key `history` erfolgt einmalig beim Aktivieren
- `HISTORY_MAX` in `history.ts` wird beim Laden des Moduls einmalig gelesen — Änderungen der Einstellung wirken erst nach Reload
- `createTemplateSeq` und `createBacktickTemplateSeq` sind direkt in `extension.ts` implementiert (nicht in `sequences/`), da beide `getSequenceFunction` rekursiv aufrufen
- Debug-Builds verwenden `tsc` (einzelne Dateien, 1:1-Sourcemaps); Produktions-Builds verwenden esbuild (Bundle). Das `browser`-Feld in `package.json` zeigt auf `dist/extension.js` (kein separates Web-Bundle mehr)
