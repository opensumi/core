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
const extension_1 = require("../../extension");
const register_1 = require("../../src/register/register");
const vimState_1 = require("../../src/state/vimState");
const clipboard_1 = require("../../src/util/clipboard");
const testSimplifier_1 = require("../testSimplifier");
const testUtils_1 = require("../testUtils");
suite('register', () => {
    let modeHandler;
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    suite('clipboard', () => {
        setup(() => __awaiter(this, void 0, void 0, function* () {
            clipboard_1.Clipboard.Copy('12345');
        }));
        newTest({
            title: "Can access '*' (clipboard) register",
            start: ['|one'],
            keysPressed: '"*P',
            end: ['1234|5one'],
        });
        newTest({
            title: "Can access '+' (clipboard) register",
            start: ['|one'],
            keysPressed: '"+P',
            end: ['1234|5one'],
        });
    });
    newTest({
        title: 'Can copy to a register',
        start: ['|one', 'two'],
        keysPressed: '"add"ap',
        end: ['two', '|one'],
    });
    newTest({
        title: 'Can use two registers together',
        start: ['|one', 'two'],
        keysPressed: '"ayyj"byy"ap"bp',
        end: ['one', 'two', 'one', '|two'],
    });
    newTest({
        title: 'Can use black hole register',
        start: ['|asdf', 'qwer'],
        keysPressed: 'yyj"_ddkp',
        end: ['asdf', '|asdf'],
    });
    test('System clipboard works with chinese characters', () => __awaiter(this, void 0, void 0, function* () {
        const testString = '你好';
        clipboard_1.Clipboard.Copy(testString);
        testUtils_1.assertEqual(testString, yield clipboard_1.Clipboard.Paste());
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        // Paste from our paste handler
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', '"', '*', 'P', 'a']);
        testUtils_1.assertEqualLines([testString]);
        // Now try the built in vscode paste
        yield vscode.commands.executeCommand('editor.action.clipboardPasteAction');
        testUtils_1.assertEqualLines([testString + testString]);
    }));
    test("Yank stores text in Register '0'", () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        yield modeHandler.handleMultipleKeyEvents('itest1\ntest2\ntest3'.split(''));
        yield modeHandler.handleMultipleKeyEvents([
            '<Esc>',
            'g',
            'g',
            'y',
            'y',
            'j',
            'y',
            'y',
            'g',
            'g',
            'd',
            'd',
            '"',
            '0',
            'P',
        ]);
        testUtils_1.assertEqualLines(['test2', 'test2', 'test3']);
    }));
    test("Multiline yank (`[count]yy`) stores text in Register '0'", () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        yield modeHandler.handleMultipleKeyEvents('itest1\ntest2\ntest3'.split(''));
        yield modeHandler.handleMultipleKeyEvents([
            '<Esc>',
            'g',
            'g',
            '2',
            'y',
            'y',
            'd',
            'd',
            '"',
            '0',
            'P',
        ]);
        testUtils_1.assertEqualLines(['test1', 'test2', 'test2', 'test3']);
    }));
    test("Multiline yank (`[count]Y`) stores text in Register '0'", () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        yield modeHandler.handleMultipleKeyEvents('itest1\ntest2\ntest3'.split(''));
        yield modeHandler.handleMultipleKeyEvents([
            '<Esc>',
            'g',
            'g',
            '2',
            'Y',
            'd',
            'd',
            '"',
            '0',
            'P',
        ]);
        testUtils_1.assertEqualLines(['test1', 'test2', 'test2', 'test3']);
    }));
    test("Register '1'-'9' stores delete content", () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        yield modeHandler.handleMultipleKeyEvents('itest1\ntest2\ntest3\n'.split(''));
        yield modeHandler.handleMultipleKeyEvents([
            '<Esc>',
            'g',
            'g',
            'd',
            'd',
            'd',
            'd',
            'd',
            'd',
            '"',
            '1',
            'p',
            '"',
            '2',
            'p',
            '"',
            '3',
            'p',
        ]);
        testUtils_1.assertEqualLines(['', 'test3', 'test2', 'test1']);
    }));
    test('"A appends linewise text to "a', () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        yield modeHandler.handleMultipleKeyEvents('itest1\ntest2\ntest3'.split(''));
        yield modeHandler.handleMultipleKeyEvents([
            '<Esc>',
            'g',
            'g',
            'v',
            'l',
            'l',
            '"',
            'a',
            'y',
            'j',
            'V',
            '"',
            'A',
            'y',
            'j',
            '"',
            'a',
            'p',
        ]);
        testUtils_1.assertEqualLines(['test1', 'test2', 'test3', 'tes', 'test2']);
    }));
    test('"A appends character wise text to "a', () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        yield modeHandler.handleMultipleKeyEvents('itest1\ntest2\n'.split(''));
        yield modeHandler.handleMultipleKeyEvents([
            '<Esc>',
            'g',
            'g',
            'v',
            'l',
            'l',
            'l',
            'l',
            '"',
            'a',
            'y',
            'j',
            'v',
            'l',
            'l',
            'l',
            'l',
            '"',
            'A',
            'y',
            'j',
            '"',
            'a',
            'p',
        ]);
        testUtils_1.assertEqualLines(['test1', 'test2', 'test1test2']);
    }));
    test('Can put and get to register', () => __awaiter(this, void 0, void 0, function* () {
        const expected = 'text-to-put-on-register';
        let vimState = new vimState_1.VimState(vscode.window.activeTextEditor);
        vimState.recordedState.registerName = '0';
        let actual;
        try {
            register_1.Register.put(expected, vimState);
            actual = yield register_1.Register.get(vimState);
            assert.equal(actual.text, expected);
        }
        catch (err) {
            assert.fail(err);
        }
    }));
    test('Small deletion using x is stored in small delete register', () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        modeHandler.vimState.registerName = '-';
        register_1.Register.put('', modeHandler.vimState);
        yield modeHandler.handleMultipleKeyEvents('itest1\ntest2\ntest3'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g', '2', 'x', 'j', '"', '-', 'p']);
        testUtils_1.assertEqualLines(['st1', 'tteest2', 'test3']);
    }));
    test('Small deletion using Del is stored in small delete register', () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        modeHandler.vimState.registerName = '-';
        register_1.Register.put('', modeHandler.vimState);
        yield modeHandler.handleMultipleKeyEvents('itest1\ntest2\ntest3'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g', '<Del>', 'j', '"', '-', 'p']);
        testUtils_1.assertEqualLines(['est1', 'ttest2', 'test3']);
    }));
    test('Small deletion using X is stored in small delete register', () => __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        modeHandler.vimState.registerName = '-';
        register_1.Register.put('', modeHandler.vimState);
        yield modeHandler.handleMultipleKeyEvents('itest1\ntest2\ntest3'.split(''));
        yield modeHandler.handleMultipleKeyEvents([
            '<Esc>',
            'g',
            'g',
            'l',
            'l',
            '2',
            'X',
            'j',
            '"',
            '-',
            'p',
        ]);
        testUtils_1.assertEqualLines(['st1', 'tteest2', 'test3']);
    }));
    test('Search register (/) is set by forward search', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('iWake up early in Karakatu, Alaska'.split('').concat(['<Esc>', '0']));
        // Register changed by forward search
        yield modeHandler.handleMultipleKeyEvents('/katu\n'.split(''));
        assert.equal((yield register_1.Register.getByKey('/')).text, 'katu');
        // Register changed even if search doesn't exist
        yield modeHandler.handleMultipleKeyEvents('0/notthere\n'.split(''));
        assert.equal((yield register_1.Register.getByKey('/')).text, 'notthere');
        // Not changed if search is canceled
        yield modeHandler.handleMultipleKeyEvents('0/Alaska'.split('').concat(['<Esc>']));
        assert.equal((yield register_1.Register.getByKey('/')).text, 'notthere');
    }));
    test('Search register (/) is set by backward search', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('iWake up early in Karakatu, Alaska'.split('').concat(['<Esc>', '$']));
        // Register changed by forward search
        yield modeHandler.handleMultipleKeyEvents('?katu\n'.split(''));
        assert.equal((yield register_1.Register.getByKey('/')).text, 'katu');
        // Register changed even if search doesn't exist
        yield modeHandler.handleMultipleKeyEvents('$?notthere\n'.split(''));
        assert.equal((yield register_1.Register.getByKey('/')).text, 'notthere');
        // Not changed if search is canceled
        yield modeHandler.handleMultipleKeyEvents('$?Alaska'.split('').concat(['<Esc>']));
        assert.equal((yield register_1.Register.getByKey('/')).text, 'notthere');
    }));
    test('Search register (/) is set by star search', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('iWake up early in Karakatu, Alaska'.split('').concat(['<Esc>', '0']));
        yield modeHandler.handleKeyEvent('*');
        assert.equal((yield register_1.Register.getByKey('/')).text, '\\bWake\\b');
        yield modeHandler.handleMultipleKeyEvents(['g', '*']);
        assert.equal((yield register_1.Register.getByKey('/')).text, 'Wake');
        yield modeHandler.handleKeyEvent('#');
        assert.equal((yield register_1.Register.getByKey('/')).text, '\\bWake\\b');
        yield modeHandler.handleMultipleKeyEvents(['g', '#']);
        assert.equal((yield register_1.Register.getByKey('/')).text, 'Wake');
    }));
    test('Command register (:) is set by command line', () => __awaiter(this, void 0, void 0, function* () {
        const command = '%s/old/new/g';
        yield modeHandler.handleMultipleKeyEvents((':' + command + '\n').split(''));
        // :reg should not update the command register
        yield modeHandler.handleMultipleKeyEvents(':reg\n'.split(''));
        const regStr = (yield register_1.Register.getByKey(':')).text.commandString;
        assert.equal(regStr, command);
    }));
    test('Read-only registers cannot be written to', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('iShould not be copied'.split('').concat(['<Esc>']));
        register_1.Register.putByKey('Expected for /', '/', undefined, true);
        register_1.Register.putByKey('Expected for .', '.', undefined, true);
        register_1.Register.putByKey('Expected for %', '%', undefined, true);
        register_1.Register.putByKey('Expected for :', ':', undefined, true);
        yield modeHandler.handleMultipleKeyEvents('"/yy'.split(''));
        yield modeHandler.handleMultipleKeyEvents('".yy'.split(''));
        yield modeHandler.handleMultipleKeyEvents('"%yy'.split(''));
        yield modeHandler.handleMultipleKeyEvents('":yy'.split(''));
        assert.equal((yield register_1.Register.getByKey('/')).text, 'Expected for /');
        assert.equal((yield register_1.Register.getByKey('.')).text, 'Expected for .');
        assert.equal((yield register_1.Register.getByKey('%')).text, 'Expected for %');
        assert.equal((yield register_1.Register.getByKey(':')).text, 'Expected for :');
    }));
});

//# sourceMappingURL=register.test.js.map
