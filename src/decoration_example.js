"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
function activate(context) {
    const disposable = vscode.commands.registerCommand('extension.insertNumberSequence', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found!');
            return;
        }
        const lineCount = Math.min(editor.document.lineCount, 20); // limit preview
        const decorationType = vscode.window.createTextEditorDecorationType({
            after: { color: '#888', margin: '0 0 0 1em' },
        });
        // Helper to update preview
        const updatePreview = (start, step = 1) => {
            const decorations = [];
            for (let i = 0; i < lineCount; i++) {
                const line = editor.document.lineAt(i);
                decorations.push({
                    range: new vscode.Range(i, line.range.end.character, i, line.range.end.character),
                    renderOptions: {
                        after: { contentText: `${start + i * step}` },
                    },
                });
            }
            editor.setDecorations(decorationType, decorations);
        };
        // --- 1️⃣ Ask for starting number, using validateInput as preview ---
        let startValue = 0;
        const startStr = await vscode.window.showInputBox({
            prompt: 'Enter the starting number for the sequence',
            placeHolder: 'e.g. 1',
            validateInput: (value) => {
                const num = Number(value);
                if (isNaN(num)) {
                    editor.setDecorations(decorationType, []); // clear preview
                    return 'Please enter a valid number';
                }
                startValue = num;
                updatePreview(num, 1);
                return null; // valid
            },
        });
        if (startStr === undefined) {
            editor.setDecorations(decorationType, []);
            return; // cancelled
        }
        startValue = Number(startStr);
        // --- 2️⃣ Ask for increment, also preview sequence dynamically ---
        let stepValue = 1;
        const stepStr = await vscode.window.showInputBox({
            prompt: 'Enter the increment (difference between numbers)',
            placeHolder: 'e.g. 1',
            validateInput: (value) => {
                const step = Number(value);
                if (isNaN(step)) {
                    updatePreview(startValue, 1);
                    return 'Please enter a valid number';
                }
                stepValue = step;
                updatePreview(startValue, step);
                return null;
            },
        });
        editor.setDecorations(decorationType, []); // clear preview after done
        if (stepStr === undefined) {
            return; // cancelled
        }
        stepValue = Number(stepStr);
        // --- 3️⃣ Insert the sequence ---
        await editor.edit((editBuilder) => {
            const cursorPos = editor.selection.active;
            const sequenceText = Array.from({ length: lineCount }, (_, i) => String(startValue + i * stepValue)).join('\n');
            editBuilder.insert(cursorPos, sequenceText);
        });
        vscode.window.showInformationMessage(`Inserted sequence starting at ${startValue} (step ${stepValue})`);
    });
    context.subscriptions.push(disposable);
}
function deactivate() { }
//# sourceMappingURL=decoration_example.js.map