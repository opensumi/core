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
const fs = require("fs");
const os = require("os");
const path_1 = require("path");
const vscode = require("vscode");
const testConfiguration_1 = require("./testConfiguration");
const globals_1 = require("../src/globals");
const textEditor_1 = require("../src/textEditor");
const extension_1 = require("../extension");
const commandLine_1 = require("../src/cmd_line/commandLine");
function rndName() {
    return Math.random()
        .toString(36)
        .replace(/[^a-z]+/g, '')
        .substr(0, 10);
}
exports.rndName = rndName;
function createRandomFile(contents, fileExtension) {
    return __awaiter(this, void 0, void 0, function* () {
        const tmpFile = path_1.join(os.tmpdir(), rndName() + fileExtension);
        fs.writeFileSync(tmpFile, contents);
        return tmpFile;
    });
}
exports.createRandomFile = createRandomFile;
/**
 * Waits for the number of text editors in the current window to equal the
 * given expected number of text editors.
 *
 * @param numExpectedEditors Expected number of editors in the window
 */
function WaitForEditorsToClose(numExpectedEditors = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        let waitForTextEditorsToClose = new Promise((c, e) => {
            if (vscode.window.visibleTextEditors.length === numExpectedEditors) {
                return c();
            }
            vscode.window.onDidChangeVisibleTextEditors(() => {
                if (vscode.window.visibleTextEditors.length === numExpectedEditors) {
                    c();
                }
            });
        });
        try {
            yield waitForTextEditorsToClose;
        }
        catch (error) {
            assert.fail(null, null, error.toString(), '');
        }
    });
}
exports.WaitForEditorsToClose = WaitForEditorsToClose;
function assertEqualLines(expectedLines) {
    for (let i = 0; i < expectedLines.length; i++) {
        let expected = expectedLines[i];
        let actual = textEditor_1.TextEditor.readLineAt(i);
        assert.equal(actual, expected, `Content does not match; Expected=${expected}. Actual=${actual}.`);
    }
    assert.equal(textEditor_1.TextEditor.getLineCount(), expectedLines.length, 'Line count does not match.');
}
exports.assertEqualLines = assertEqualLines;
/**
 * Assert that the first two arguments are equal, and fail a test otherwise.
 *
 * The only difference between this and assert.equal is that here we
 * check to ensure the types of the variables are correct.
 */
function assertEqual(one, two, message = '') {
    assert.equal(one, two, message);
}
exports.assertEqual = assertEqual;
function setupWorkspace(config = new testConfiguration_1.Configuration(), fileExtension = '') {
    return __awaiter(this, void 0, void 0, function* () {
        yield commandLine_1.commandLine.load();
        const filePath = yield createRandomFile('', fileExtension);
        const doc = yield vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        yield vscode.window.showTextDocument(doc);
        globals_1.Globals.mockConfiguration = config;
        yield reloadConfiguration();
        let activeTextEditor = vscode.window.activeTextEditor;
        assert.ok(activeTextEditor);
        activeTextEditor.options.tabSize = config.tabstop;
        activeTextEditor.options.insertSpaces = config.expandtab;
        yield mockAndEnable();
    });
}
exports.setupWorkspace = setupWorkspace;
const mockAndEnable = () => __awaiter(this, void 0, void 0, function* () {
    yield vscode.commands.executeCommand('setContext', 'vim.active', true);
    const mh = yield extension_1.getAndUpdateModeHandler();
    globals_1.Globals.mockModeHandler = mh;
    yield mh.handleKeyEvent('<ExtensionEnable>');
});
function cleanUpWorkspace() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((c, e) => {
            if (vscode.window.visibleTextEditors.length === 0) {
                return c();
            }
            // TODO: the visibleTextEditors variable doesn't seem to be
            // up to date after a onDidChangeActiveTextEditor event, not
            // even using a setTimeout 0... so we MUST poll :(
            let interval = setInterval(() => {
                if (vscode.window.visibleTextEditors.length > 0) {
                    return;
                }
                clearInterval(interval);
                c();
            }, 10);
            vscode.commands.executeCommand('workbench.action.closeAllEditors').then(() => null, (err) => {
                clearInterval(interval);
                e(err);
            });
        }).then(() => {
            assert.equal(vscode.window.visibleTextEditors.length, 0, 'Expected all editors closed.');
            assert(!vscode.window.activeTextEditor, 'Expected no active text editor.');
        });
    });
}
exports.cleanUpWorkspace = cleanUpWorkspace;
function reloadConfiguration() {
    return __awaiter(this, void 0, void 0, function* () {
        let validatorResults = (yield require('../src/configuration/configuration').configuration.load());
        for (let validatorResult of validatorResults.get()) {
            console.log(validatorResult);
        }
    });
}
exports.reloadConfiguration = reloadConfiguration;
/**
 * Waits for the tabs to change after a command like 'gt' or 'gT' is run.
 * Sometimes it is not immediate, so we must busy wait
 * On certain versions, the tab changes are synchronous
 * For those, a timeout is given
 */
function waitForTabChange() {
    return __awaiter(this, void 0, void 0, function* () {
        yield new Promise((resolve, reject) => {
            setTimeout(resolve, 500);
            const disposer = vscode.window.onDidChangeActiveTextEditor(textEditor => {
                disposer.dispose();
                resolve(textEditor);
            });
        });
    });
}
exports.waitForTabChange = waitForTabChange;

//# sourceMappingURL=testUtils.js.map
