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
const extension_1 = require("../../extension");
const mode_1 = require("../../src/mode/mode");
const testSimplifier_1 = require("../testSimplifier");
const testUtils_1 = require("./../testUtils");
suite('Mode Visual Block', () => {
    let modeHandler;
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('can be activated', () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        yield modeHandler.handleKeyEvent('<C-v>');
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualBlock);
        yield modeHandler.handleKeyEvent('<C-v>');
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
    }));
    newTest({
        title: 'Can handle A forward select',
        start: ['|test', 'test'],
        keysPressed: 'l<C-v>ljA123',
        end: ['tes123|t', 'tes123t'],
    });
    newTest({
        title: 'Can handle A backwards select',
        start: ['tes|t', 'test'],
        keysPressed: 'h<C-v>hjA123',
        end: ['tes123|t', 'tes123t'],
    });
    newTest({
        title: 'Can handle I forward select',
        start: ['|test', 'test'],
        keysPressed: 'l<C-v>ljI123',
        end: ['t123|est', 't123est'],
    });
    newTest({
        title: 'Can handle I backwards select',
        start: ['tes|t', 'test'],
        keysPressed: 'h<C-v>hjI123',
        end: ['t123|est', 't123est'],
    });
    newTest({
        title: 'Can handle I with empty lines on first character (inserts on empty line)',
        start: ['|test', '', 'test'],
        keysPressed: '<C-v>lljjI123',
        end: ['123|test', '123', '123test'],
    });
    newTest({
        title: 'Can handle I with empty lines on non-first character (does not insert on empty line)',
        start: ['t|est', '', 'test'],
        keysPressed: '<C-v>lljjI123',
        end: ['t123|est', '', 't123est'],
    });
    newTest({
        title: 'Can handle c forward select',
        start: ['|test', 'test'],
        keysPressed: 'l<C-v>ljc123',
        end: ['t123|t', 't123t'],
    });
    newTest({
        title: 'Can handle c backwards select',
        start: ['tes|t', 'test'],
        keysPressed: 'h<C-v>hjc123',
        end: ['t123|t', 't123t'],
    });
    newTest({
        title: 'Can handle C',
        start: ['tes|t', 'test'],
        keysPressed: 'h<C-v>hjC123',
        end: ['t123|', 't123'],
    });
    newTest({
        title: 'Can do a multi line replace',
        start: ['one |two three four five', 'one two three four five'],
        keysPressed: '<C-v>jeer1',
        end: ['one |111111111 four five', 'one 111111111 four five'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: "Can handle 'D'",
        start: ['tes|t', 'test'],
        keysPressed: '<C-v>hjD',
        end: ['t|e', 'te'],
    });
    newTest({
        title: "Can handle 'gj'",
        start: ['t|est', 'test'],
        keysPressed: '<C-v>gjI123',
        end: ['t123|est', 't123est'],
    });
    suite('Non-darwin <C-c> tests', () => {
        if (process.platform === 'darwin') {
            return;
        }
        test('<C-c> copies and sets mode to normal', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ione two three'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'Y', 'p', 'p']);
            testUtils_1.assertEqualLines(['one two three', 'one two three', 'one two three']);
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'H', '<C-v>', 'e', 'j', 'j', '<C-c>']);
            // ensuring we're back in normal
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
            // test copy by pasting back
            yield modeHandler.handleMultipleKeyEvents(['H', '"', '+', 'P']);
            // TODO: should be
            // assertEqualLines(['oneone two three', 'oneone two three', 'oneone two three']);
            // unfortunately it is
            testUtils_1.assertEqualLines(['one', 'one', 'one', 'one two three', 'one two three', 'one two three']);
        }));
    });
    newTest({
        title: 'Properly add to end of lines j then $',
        start: ['|Dog', 'Angry', 'Dog', 'Angry', 'Dog'],
        keysPressed: '<C-v>4j$Aaa',
        end: ['Dogaa|', 'Angryaa', 'Dogaa', 'Angryaa', 'Dogaa'],
    });
    newTest({
        title: 'Properly add to end of lines $ then j',
        start: ['|Dog', 'Angry', 'Dog', 'Angry', 'Dog'],
        keysPressed: '<C-v>$4jAaa<Esc>',
        end: ['Doga|a', 'Angryaa', 'Dogaa', 'Angryaa', 'Dogaa'],
    });
    newTest({
        title: 'o works in visual block mode',
        start: ['|foo', 'bar', 'baz'],
        keysPressed: '<C-v>jjllold',
        end: ['|f', 'b', 'b'],
    });
});

//# sourceMappingURL=modeVisualBlock.test.js.map
