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
suite('cursor location', () => {
    let modeHandler;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    test('cursor location in command line', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            ':',
            't',
            'e',
            's',
            't',
            '<right>',
            '<right>',
            '<right>',
            '<left>',
        ]);
        const statusBarAfterCursorMovement = statusBar_1.StatusBar.Get();
        yield modeHandler.handleKeyEvent('<Esc>');
        const statusBarAfterEsc = statusBar_1.StatusBar.Get();
        assert.equal(statusBarAfterCursorMovement.trim(), ':tes|t', 'Command Tab Completion Failed');
    }));
    test('cursor location in search', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            '/',
            't',
            'e',
            's',
            't',
            '<right>',
            '<right>',
            '<right>',
            '<left>',
        ]);
        const statusBarAfterCursorMovement = statusBar_1.StatusBar.Get();
        yield modeHandler.handleKeyEvent('<Esc>');
        const statusBarAfterEsc = statusBar_1.StatusBar.Get();
        assert.equal(statusBarAfterCursorMovement.trim(), '/tes|t', 'Command Tab Completion Failed');
    }));
});

//# sourceMappingURL=cursorLocation.test.js.map
