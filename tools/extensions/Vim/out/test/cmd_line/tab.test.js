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
const vscode = require("vscode");
const assert = require("assert");
const extension_1 = require("../../extension");
const commandLine_1 = require("../../src/cmd_line/commandLine");
const testUtils_1 = require("../testUtils");
suite('cmd_line tab', () => {
    let modeHandler;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    test('tabe with no arguments when not in workspace opens an untitled file', () => __awaiter(this, void 0, void 0, function* () {
        const beforeEditor = vscode.window.activeTextEditor;
        yield commandLine_1.commandLine.Run('tabe', modeHandler.vimState);
        const afterEditor = vscode.window.activeTextEditor;
        assert.notEqual(beforeEditor, afterEditor, 'Active editor did not change');
    }));
    test('tabedit with no arguments when not in workspace opens an untitled file', () => __awaiter(this, void 0, void 0, function* () {
        const beforeEditor = vscode.window.activeTextEditor;
        yield commandLine_1.commandLine.Run('tabedit', modeHandler.vimState);
        const afterEditor = vscode.window.activeTextEditor;
        assert.notEqual(beforeEditor, afterEditor, 'Active editor did not change');
    }));
    test('tabe with absolute path when not in workspace opens file', () => __awaiter(this, void 0, void 0, function* () {
        const filePath = yield testUtils_1.createRandomFile('', '');
        yield commandLine_1.commandLine.Run(`tabe ${filePath}`, modeHandler.vimState);
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) {
            assert.fail('File did not open');
        }
        else {
            if (process.platform !== 'win32') {
                assert.equal(editor.document.fileName, filePath, 'Opened wrong file');
            }
            else {
                assert.equal(editor.document.fileName.toLowerCase(), filePath.toLowerCase(), 'Opened wrong file');
            }
        }
    }));
    test('tabe with current file path does nothing', () => __awaiter(this, void 0, void 0, function* () {
        const filePath = yield testUtils_1.createRandomFile('', '');
        yield commandLine_1.commandLine.Run(`tabe ${filePath}`, modeHandler.vimState);
        const beforeEditor = vscode.window.activeTextEditor;
        yield commandLine_1.commandLine.Run(`tabe ${filePath}`, modeHandler.vimState);
        const afterEditor = vscode.window.activeTextEditor;
        assert.equal(beforeEditor, afterEditor, 'Active editor changed even though :tabe opened the same file');
    }));
});

//# sourceMappingURL=tab.test.js.map
