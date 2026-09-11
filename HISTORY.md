# History of completed TODO items

_No completed tasks were found at the time of restructuring._

## 1. Kritische Bugs (Schweregrad: Hoch)

### 1.1 History wird beim normalen Einfügen niemals gespeichert

- **Datei:** `src/extension.ts`, Zeilen 369–373
- **Code:**
    ```typescript
    // insert final sequence (check if canceled will be done in insertNewSequence and in saveToHistory)
    insertNewSequence(input, parameter, 'final');
    if (input === undefined) {
    	// save input to local history storage
    	saveToHistory(context, input);
    }
    ```
- **Ursache:** Die Bedingung prüft `if (input === undefined)`.
    - Bestätigt der Benutzer eine Eingabe mit Enter (`input !== undefined`), wird `saveToHistory` **gar nicht aufgerufen**.
    - Bricht der Benutzer mit Esc ab (`input === undefined`), wird `saveToHistory(context, undefined)` aufgerufen, welches dort sofort per `if (command == null) return;` abbricht.
- **Auswirkung:** Die Eingabe-History wird in `InsertSeqCommand` **nie** befüllt.
- **Fix:**
    ```typescript
    if (input !== undefined) {
    	saveToHistory(context, input);
    }
    ```

---

### 1.2 Datenverlust bei Abbruch im History-QuickPick (`InsertSeqHistory`)

- **Datei:** `src/extension.ts`, Zeilen 398–410 sowie 1147–1178
- **Code:**
    ```typescript
    async function InsertSeqHistory(context: vscode.ExtensionContext, value: string) {
        ...
        const parameter: TParameter = await initApp(editor);
        const qp = createQuickPick(context, parameter);
        if (qp.items.length > 1) {
            qp.show();
        }
        ...
    ```
- **Ursache:**
    1. `initApp(editor)` löscht direkt zu Beginn den markierten Text aller Cursors (`builder.replace(selection, '')`).
    2. Schließt der Benutzer den QuickPick per Escape oder Klick ins Editorfenster, ruft `qp.onDidHide` lediglich `editor.setDecorations(previewDecorationType, [])` auf. `insertNewSequence(undefined, parameter, 'final')` (welches den gelöschten Text wiederherstellen würde) wird **nicht** aufgerufen.
    3. Wählt der Benutzer im QuickPick _"New sequence"_ (`cmd === ''`) oder klickt auf das _Edit_-Icon eines Eintrags, wird `InsertSeqCommand` aufgerufen. `InsertSeqCommand` ruft erneut `initApp` auf. Da der selektierte Text aber bereits gelöscht ist, ist `parameter.origTextSel` im zweiten Durchlauf leer (`['']`). Bricht der Nutzer danach in der InputBox ab, wird nur noch ein leerer Text restauriert.
- **Auswirkung:** Der zuvor im Editor markierte Text des Benutzers geht verloren.
- **Fix:**
    - In `qp.onDidHide()` prüfen, ob eine finale Ausführung stattgefunden hat; falls nicht, Text wiederherstellen (`insertNewSequence(undefined, parameter, 'final')`).
    - Beim Weiterleiten an `InsertSeqCommand` das bereits vorhandene `parameter`-Objekt übergeben, anstatt `initApp` doppelt auszuführen.

---

### 1.3 Entkopplung von Cursor-Positionen und selektiertem Text bei Sortierung

- **Datei:** `src/extension.ts`, Zeilen 483–487
- **Code:**
    ```typescript
    const insertCursorPos = sortSelectionsByPosition(
    	parameter.origCursorPos,
    	sorted ? true : false,
    	reverse ? true : false,
    );
    ```
- **Ursache:** Bei aktiviertem `sortedOutput` (`$`) oder `reversedOutput` (`!`) werden die Cursor-Positionen in `insertCursorPos` umsortiert. Das zugehörige Array `parameter.origTextSel` behält jedoch seine ursprüngliche Klick-Reihenfolge.
- **Auswirkung:**
    - Bei `textSelected` (`createTextSelectedSeq`) oder Ausdrücken mit dem Token `o` passt `origTextSel[i]` nicht mehr zu `insertCursorPos[i]`. Selektierte Texte werden an den falschen Cursors eingesetzt.
    - Bricht der Nutzer bei aktiver Sortierung/Umkehrung ab, wird der Originaltext an den falschen Positionen wiederhergestellt.
- **Fix:** Cursors und selektierte Texte als Tupel `Array<{ pos: vscode.Selection, text: string }>` gemeinsam sortieren.

---

### 1.4 Absturz bei String-Sequenzen mit negativem Step

- **Datei:** `src/sequences/string.ts`, Zeilen 56–58
- **Code:**
    ```typescript
    function indexToString(index: number): string {
        if (index < 0) {
            throw new Error('Index below possible values!');
        }
        ...
    ```
- **Ursache:** Wenn der Benutzer eine Sequenz rückwärts laufen lässt (z. B. `c:-1` mit 5 Cursors: `c` (2), `b` (1), `a` (0), `-1`), wirft `indexToString` eine Exception.
- **Auswirkung:** In `insertNewSequence` wird `currSeqFunction(i)` ohne `try/catch` aufgerufen. Die Exception bringt den Ausführungskontext zum Absturz. Der selektierte Text wird nicht wiederhergestellt.
- **Fix:** In `string.ts` bei `index < 0` die Sequenz stoppen (`stopFunction = true; return { stringFunction: '', stopFunction: true }`) oder einen Modulo-Wrap auf das Alphabet anwenden.

---

### 1.5 Absturz bei Overflow in Ausdrücken (`expression.ts`)

- **Datei:** `src/sequences/expression.ts`, Zeile 88
- **Code:**
    ```typescript
    } else if (parameter.origTextSel[i].length === 0) {
        replacableValues.currentValueStr = (i + 1).toString();
    }
    ```
- **Ursache:** Wenn durch eine Stop-Condition (z. B. `@i > 10`) mehr Werte generiert werden als Cursors vorhanden sind, ist `parameter.origTextSel[i]` für `i >= parameter.origTextSel.length` gleich `undefined`. Der Zugriff auf `.length` wirft einen `TypeError: Cannot read properties of undefined (reading 'length')`.
- **Fix:** `} else if (!parameter.origTextSel[i] || parameter.origTextSel[i].length === 0) {`

---

## 2. Berechnungs-, Logik- und Parsing-Fehler (Schweregrad: Mittel)

### 2.1 String-Wrapping & Typschwächen in `replaceSpecialChars`

- **Datei:** `src/components/utils.ts`, Zeilen 338–361
- **Probleme:**
    1. **Konkatenations-Bug bei Zahlen:** `_` wird immer mit einfachen Anführungszeichen umschlossen:
        ```typescript
        .replace(/\b_\b/gi, `'${para.currentValueStr}'`)
        ```
        Bei einem Dezimal-Ausdruck `1:: _ + 10` wird `_` zu `'1'`. In JavaScript ergibt `'1' + 10` den String `'110'`, statt der erwarteten Zahl `11`!
    2. **Quote-Escaping-Bug:** Wenn der selektierte Text `o` oder der String `_` einfache Anführungszeichen enthält (z. B. `don't`), führt `'don't'` zu einem Syntaxfehler beim Evaluieren.
    3. **Null/Zero-Handling:** `Number(para.origTextStr) ? para.origTextStr : `'${para.origTextStr}'``: Wenn `origTextStr === '0'`, ist `Number('0') === 0`(falsy in JS). Dadurch wird die Zahl`0` fälschlicherweise in Quotes gepackt (`'0'`). Dasselbe gilt für `c`und`p`.
    4. **Case-Insensitive `/gi`:** Die Flags `/gi` ersetzen auch Großbuchstaben und können JavaScript-Identifier in Ausdrücken beschädigen (z. B. `'i = ' + i` wird zu `'0 = ' + 0`).
- **Fix:** Anstelle von Quelltext-Stringersetzungen sollten die Werte als Scope-Variablen direkt an `safeEvaluate(code, timeout, context)` übergeben werden (siehe [Abschnitt 6](#6-vorschläge-für-architektur--testautomatisierung)).

---

### 2.2 Numerische Ausdrücke ignorieren das Ergebnis `0`

- **Datei:** `src/sequences/decimal.ts`, Zeilen 150–152
- **Code:**
    ```typescript
    let exprResult = runExpression(replaceSpecialChars(expr, replacableValues));
    if (Number(exprResult)) {
    	value = Number(exprResult);
    }
    ```
- **Ursache:** Wenn ein Ausdruck zu `0` ausgewertet wird (z. B. `_ * 0` oder `_ - 1` bei Startwert 1), ergibt `Number(0)` den Wert `0`. `if (0)` ist in JavaScript `false`.
- **Auswirkung:** Das Ergebnis `0` wird ignoriert und der alte Wert bleibt stehen.
- **Fix:**
    ```typescript
    if (exprResult !== null && Number.isFinite(Number(exprResult))) {
    	value = Number(exprResult);
    }
    ```

---

### 2.3 Fehlendes Füllzeichen `#` in `formatString` & fehlschlagender Test

- **Datei:** `src/formatting.ts`, Zeile 43 sowie `src/formatting.test.ts`, Zeile 10
- **Code:**
    ```typescript
    const re = /^([0x\s\._]?)([<>\=])?(\d+)?([wW]?)([lrLR]?)$/;
    ```
- **Problem:** In der Zeichenklasse für das Füllzeichen (`fill`) fehlt `#`. Im Docstring wird jedoch explizit `#<10` als Beispiel dokumentiert, und der Test `assertEqual(formatString('42', '#<5'), '42###')` prüft genau dies.
- **Auswirkung:** `node dist/formatting.test.js` bricht sofort mit einem Assertions-Fehler ab.
- **Fix:** Zeichenklasse erweitern: `^([0x\s\._#]?)...`

---

### 2.4 Datumsformatierung: Locale `de-DE` wird zu `9e-DE`

- **Datei:** `src/formatting.ts`, Zeile 200 & 216
- **Ursache:** `formatTemporalDateTime` definiert `d` als Token für den Tag des Monats. Bei Übergabe einer Locale als Template (z. B. `de-DE`) matcht das Token `d` und ersetzt den ersten Buchstaben durch den Tag (z. B. `9` am 9. Tag des Monats) -> `"9e-DE"`.
- **Auswirkung:** Da `"9e-DE" !== "de-DE"` ist, schlägt der Locale-Fallback fehl und es wird `"9e-DE"` in das Dokument eingefügt.
- **Fix:** BCP-47 Locale-Strings (`/^[a-z]{2,3}(-[a-z]{2,4})?$/i`) vorab erkennen oder Tokenersetzung nur durchführen, wenn das Template Datums-Formatzeichen enthält.

---

### 2.5 Eigene Listen (`own.ts`) und `predefined.ts`

- **Datei:** `src/sequences/own.ts` und `src/sequences/predefined.ts`
- **Probleme:**
    1. **Abbruch bei Index >= Länge:** In `own.ts:75` steht `i < ownSeq.length ? ownSeq[...] : ''`. Bei mehr Cursors als Listenelementen wird `currentValueStr` ab `i >= ownSeq.length` leer, obwohl zirkulär wiederholt werden soll.
    2. **Negativer Array-Index:** Bei negativer Schrittweite (`step < 0`) kann der Index negativ werden (`(start - 1 + step * ...) % len`). In JS liefert `-1 % 3 = -1`. `ownSeq[-1]` ist `undefined`. Der korrekte Modulo-Wrap lautet: `((idx % len) + len) % len`.
    3. **Ausdrücke ungenutzt:** `expr` wird in beiden Dateien extrahiert, aber nie angewendet.

---

### 2.6 Sortier- und Umkehr-Flags (`$!` bzw. `!$`) schließen sich gegenseitig aus

- **Datei:** `src/components/evaluator.ts`, Zeilen 422–423
- **Code:**
    ```typescript
    ruleTemplate.outputSort = `\\$!?\\s*$`;
    ruleTemplate.outputReverse = `!\\$?\\s*$`;
    ```
- **Problem:**
    - Bei `1:1$!` matcht `outputReverse` nicht (erfordert führendes `!`).
    - Bei `1:1!$` matcht `outputSort` nicht (erfordert führendes `$`).
- **Auswirkung:** Die kombinierte Angabe von Sortierung und Umkehrung am Eingabeende funktioniert nicht.
- **Fix:** Regex so anpassen, dass das Zeichen unabhängig von der Reihenfolge am Ende gematcht wird: `(?:\$!|!\$|\$)\s*$` bzw. `(?:\$!|!\$|!)\s*$`.

---

### 2.7 Mehrstellige Delimiter werden am Ende falsch beschnitten

- **Datei:** `src/extension.ts`, Zeile 625
- **Code:**
    ```typescript
    builder.replace(currSel, addStr.slice(0, -1));
    ```
- **Problem:** Bei Delimitern mit mehr als einem Zeichen (z. B. `", "` oder `-`) entfernt `.slice(0, -1)` nur ein einzelnes Zeichen.
- **Fix:** `addStr.slice(0, -delimiter.length)`

---

### 2.8 Fehlendes Default-Datum bei Präfix `date:`

- **Datei:** `src/sequences/date.ts`, Zeile 37
- **Code:**
    ```typescript
    if (input.match(/^%(?!\d)/)) {
    	input = '%' + Temporal.Now.plainDateISO().toString() + input.slice(1);
    }
    ```
- **Problem:** Die automatische Einsetzung des heutigen Datums erfolgt nur für `%`, nicht für `date:`. Eine Eingabe von `date:` oder `date::1w` schlägt fehl.
- **Fix:** Regex erweitern auf `/^(?:%|date:)(?!\d)/i`.

---

## 3. Codequalität, Toter Code & Inkonsistenzen

1. **`src/sequence.ts`:** Vollständig toter Code. Die exportierte Funktion `generateSequence` wird im gesamten Projekt nicht importiert.
2. **`src/regexBuilder.ts`:** Leere Datei (0 Bytes), kann gelöscht werden.
3. **`src/formatting.ts:120`:** `formatDateStr` ist als `@deprecated` markiert und wird intern nicht genutzt.
4. **`src/components/safeEval.ts:50`:** Die Funktion `serializeValue` ist ungenutzt, da später `serializeValueLocal` definiert wurde.
5. **ESLint-Warnungen:** Das Projekt wirft 86 Linter-Warnungen (hauptsächlich fehlende geschweifte Klammern nach `if` und ungenutzte Variablen/Imports).
6. **Kein `npm test`-Skript:** In `package.json` ist kein Testbefehl registriert; Tests werden im normalen Build nach `dist/` mitkompiliert.

### 4.1 UUID / GUID-Generator (v4, v7)

- **Nutzen:** Gehört zu den häufigsten Anwendungsfällen bei Multi-Cursor-Arbeiten (Mockdaten, Datenbank-Inserts, JSON-Fixtures).
- **Syntax-Idee:**
    - `uuid` oder `%uuid` für Standard-UUIDs (v4)
    - `uuid:v7` für zeitlich sortierbare UUIDs
    - `uuid~upper` für Großbuchstaben, `uuid~clean` ohne Bindestriche

### 4.2 Erweiterte Zeit- und Timestamp-Sequenzen

- **Aktueller Stand:** `date.ts` setzt Zeitwerte fix auf `00:00:00`.
- **Erweiterung:**
    - Uhrzeiten mit Schritten in Stunden, Minuten oder Sekunden (`14:00:15m`, `09:30:10s`)
    - Unix-Timestamps in Sekunden (`%now:1s~epoch`) oder Millisekunden (`~epochms`)
    - ISO-8601 UTC Timestamps (`2026-03-09T20:00:00Z`)

### 4.4 Zufalls-Token, Passwörter & Hash-Strings

- **Nutzen:** Schnelles Generieren von Dummy-Passwörtern oder Test-Hashes.
- **Syntax-Idee:** `rnd:12` (12-stelliger alphanumerischer Zufallsstring) oder `hex:16` (16 Bytes hexadezimal).

### 4.3 Römische Ziffern

- **Nutzen:** Beliebt für Gliederungen in Markdown, HTML-Listen oder Dokumentationen.
- **Syntax-Idee:** `I` (groß: I, II, III...) oder `i` (klein: i, ii, iii...).

### 4.5 Netzwerk- & IP-Adressen

- **Nutzen:** DevOps- und Netzwerk-Konfigurationen (Subnetze, Host-Listen).
- **Syntax:** `192.168.1.1:1` -> zählt das letzte Oktett hoch (`192.168.1.1`, `.2`, `.3`, ...), inklusive Subnetz-Übertrag (`192.168.1.255:1` -> `192.168.2.0`), CIDR-Erhalt (`10.0.0.1/24:1`), negativer Schritte (`10.0.1.0:-1`), Format-Optionen (`~0`, `~hex`, `~bin`, `~int`) und Default-Präfix (`:ip:1`).

### 5.1 Quick-Presets / Favoriten (Named Sequences)

- **Nutzen:** Häufig genutzte Sequenzeingaben dauerhaft unter einem sprechenden Namen speichern, per Schnellmenü abrufen und direkt einfügen.
- **Implementierung:**
  - Presets-Manager in `src/components/presets.ts` mit get, save, delete, clear und resetToDefault.
  - Befehle: `extension.insertseq.presets` ("Insert Sequences: Presets / Favorites", Tastenkürzel `Ctrl+Alt+P` / `Cmd+Alt+P`) und `extension.insertseq.savePreset` ("Insert Sequences: Save as Preset").
  - Schnellspeichern aus dem History-QuickPick per Stern-Icon (`⭐`) an jedem Eintrag.
  - Interaktives Bearbeiten und Löschen von Presets direkt im QuickPick mit Live-Preview.
  - Persistierung in `insertseq.presets` (Workspace/User-Settings) und `globalState`.

### 5.2 Interaktiver Wizard / Sequenz-Assistent

- **Nutzen:** Schneller, geführter Einstieg in die Sequenzerstellung per Menüauswahl für Benutzer, die die kompakte Syntax nicht auswendig kennen.
- **Implementierung:**
  - Mehrstufiger Assistent in `src/components/wizard.ts` mit voller Back-Navigation (`QuickInputButtons.Back`) und dynamischer Live-Decoration-Preview bei jedem Einzelschritt.
  - Befehl: `extension.insertseq.wizard` ("Insert Sequences: Wizard", Tastenkürzel `Ctrl+Alt+W` / `Cmd+Alt+W`).
  - Direkter Zauberstab-Button (`🪄`) in History- und Presets-Menüleisten.
  - Unterstützt Kategorien:
    - 🔢 Zahlen & Ganzzahlen (Start, Schrittweite, Formatierung/Zero-Padding/Römisch)
    - 🔤 Buchstaben & Alphabet (Start, Schrittweite, Casing: klein/groß/pascal)
    - 📅 Datum & Uhrzeit (Jetzt, Heute, Uhrzeit, Schrittweiten wie Tage/Wochen/Monate/Stunden, Format-Tokens)
    - 🛠️ DevOps, UUIDs & Passwörter (UUID v4/v7, alphanumerische Token, Passwörter, Hashes, PIN-Codes, IPv4)
    - 📋 Benutzerdefinierte Listen / Wortfolgen (kommagetrennte Eingabe)
    - ⚡ JavaScript-Ausdrücke (Formelvorlagen und benutzerdefinierte Ausdrücke)
  - Abschluss-Optionen: Direkt einfügen (`Insert`), Feintuning in der regulären InputBox (`Fine-tune`), oder als Favorit speichern (`Save as Preset`).


