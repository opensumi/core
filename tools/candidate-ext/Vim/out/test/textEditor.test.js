"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const textEditor_1 = require("./../src/textEditor");
const testUtils_1 = require("./testUtils");
suite('text editor', () => {
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
    }));
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    test("insert 'Hello World'", () => __awaiter(this, void 0, void 0, function* () {
        let expectedText = 'Hello World';
        yield textEditor_1.TextEditor.insert(expectedText);
        assert.equal(vscode.window.activeTextEditor.document.lineCount, 1);
        let actualText = textEditor_1.TextEditor.readLineAt(0);
        assert.equal(actualText, expectedText);
    }));
    test("replace 'World' with 'Foo Bar'", () => __awaiter(this, void 0, void 0, function* () {
        let newText = 'Foo Bar';
        let start = new vscode.Position(0, 6);
        let end = new vscode.Position(0, 11);
        let range = new vscode.Range(start, end);
        yield textEditor_1.TextEditor.replace(range, newText);
        assert.equal(vscode.window.activeTextEditor.document.lineCount, 1);
        let actualText = textEditor_1.TextEditor.readLineAt(0);
        assert.equal(actualText, 'Hello Foo Bar');
    }));
    test('delete `Hello`', () => __awaiter(this, void 0, void 0, function* () {
        assert.equal(vscode.window.activeTextEditor.document.lineCount, 1);
        let end = new vscode.Position(0, 5);
        let range = new vscode.Range(new vscode.Position(0, 0), end);
        yield textEditor_1.TextEditor.delete(range);
        let actualText = textEditor_1.TextEditor.readLineAt(0);
        assert.equal(actualText, ' Foo Bar');
    }));
    test('delete the whole line', () => __awaiter(this, void 0, void 0, function* () {
        assert.equal(vscode.window.activeTextEditor.document.lineCount, 1);
        let range = vscode.window.activeTextEditor.document.lineAt(0).range;
        yield textEditor_1.TextEditor.delete(range);
        let actualText = textEditor_1.TextEditor.readLineAt(0);
        assert.equal(actualText, '');
    }));
    test("try to read lines that don't exist", () => {
        assert.equal(vscode.window.activeTextEditor.document.lineCount, 1);
        assert.throws(() => textEditor_1.TextEditor.readLineAt(1), RangeError);
        assert.throws(() => textEditor_1.TextEditor.readLineAt(2), RangeError);
    });
});

//# sourceMappingURL=textEditor.test.js.map
