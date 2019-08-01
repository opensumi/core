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
const extension_1 = require("../../extension");
const testUtils_1 = require("../testUtils");
const statusBar_1 = require("../../src/statusBar");
suite('cmd_line tabComplete', () => {
    let modeHandler;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    test('command line command tab completion', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([':', 'e', 'd', 'i']);
        yield modeHandler.handleKeyEvent('<tab>');
        const statusBarAfterTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleKeyEvent('<Esc>');
        assert.equal(statusBarAfterTab.trim(), ':edit|', 'Command Tab Completion Failed');
    }));
    test('command line file tab completion with no base path', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleKeyEvent(':');
        const statusBarBeforeTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleMultipleKeyEvents(['e', ' ', '<tab>']);
        const statusBarAfterTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleKeyEvent('<Esc>');
        assert.notEqual(statusBarBeforeTab, statusBarAfterTab, 'Status Bar did not change');
    }));
    test('command line file tab completion with / as base path', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleKeyEvent(':');
        const statusBarBeforeTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleMultipleKeyEvents(['e', ' ', '.', '.', '/', '<tab>']);
        const statusBarAfterTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleKeyEvent('<Esc>');
        assert.notEqual(statusBarBeforeTab, statusBarAfterTab, 'Status Bar did not change');
    }));
    test('command line file tab completion with ~/ as base path', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleKeyEvent(':');
        const statusBarBeforeTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleMultipleKeyEvents(['e', ' ', '~', '/', '<tab>']);
        const statusBarAfterTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleKeyEvent('<Esc>');
        assert.notEqual(statusBarBeforeTab, statusBarAfterTab, 'Status Bar did not change');
    }));
    test('command line file tab completion with ./ as base path', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleKeyEvent(':');
        const statusBarBeforeTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleMultipleKeyEvents(['e', ' ', '.', '/', '<tab>']);
        const statusBarAfterTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleKeyEvent('<Esc>');
        assert.notEqual(statusBarBeforeTab, statusBarAfterTab, 'Status Bar did not change');
    }));
    test('command line file tab completion with ../ as base path', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleKeyEvent(':');
        const statusBarBeforeTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleMultipleKeyEvents(['e', ' ', '.', '.', '/', '<tab>']);
        const statusBarAfterTab = statusBar_1.StatusBar.Get();
        yield modeHandler.handleKeyEvent('<Esc>');
        assert.notEqual(statusBarBeforeTab, statusBarAfterTab, 'Status Bar did not change');
    }));
});

//# sourceMappingURL=tabCompletion.test.js.map
