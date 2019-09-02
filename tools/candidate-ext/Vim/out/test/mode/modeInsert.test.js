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
const extension_1 = require("../../extension");
const mode_1 = require("../../src/mode/mode");
const textEditor_1 = require("../../src/textEditor");
const testSimplifier_1 = require("../testSimplifier");
const testUtils_1 = require("./../testUtils");
const globals_1 = require("../../src/globals");
suite('Mode Insert', () => {
    let modeHandler;
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('can be activated', () => __awaiter(this, void 0, void 0, function* () {
        let activationKeys = ['o', 'I', 'i', 'O', 'a', 'A', '<Insert>'];
        for (let key of activationKeys) {
            yield modeHandler.handleKeyEvent('<Esc>');
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
            yield modeHandler.handleKeyEvent(key);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Insert);
        }
    }));
    test('can handle key events', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', '!']);
        return testUtils_1.assertEqualLines(['!']);
    }));
    test('<Esc> should change cursor position', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 'h', 'e', 'l', 'l', 'o', '<Esc>']);
        testUtils_1.assertEqual(textEditor_1.TextEditor.getSelection().start.character, 4, '<Esc> moved cursor position.');
    }));
    test('<C-c> can exit insert', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 't', 'e', 'x', 't', '<C-c>', 'o']);
        return testUtils_1.assertEqualLines(['text', '']);
    }));
    test('<Esc> can exit insert', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 't', 'e', 'x', 't', '<Esc>', 'o']);
        return testUtils_1.assertEqualLines(['text', '']);
    }));
    test('Stay in insert when entering characters', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleKeyEvent('i');
        for (var i = 0; i < 10; i++) {
            yield modeHandler.handleKeyEvent('1');
            testUtils_1.assertEqual(modeHandler.currentMode.name === mode_1.ModeName.Insert, true);
        }
    }));
    test("Can handle 'O'", () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 't', 'e', 'x', 't', '<Esc>', 'O']);
        return testUtils_1.assertEqualLines(['', 'text']);
    }));
    test("Can handle 'i'", () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            't',
            'e',
            'x',
            't',
            't',
            'e',
            'x',
            't',
            '<Esc>',
            '^',
            'l',
            'l',
            'l',
            'l',
            'i',
            '!',
        ]);
        testUtils_1.assertEqualLines(['text!text']);
    }));
    test("Can handle 'I'", () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            't',
            'e',
            'x',
            't',
            '<Esc>',
            '^',
            'l',
            'l',
            'l',
            'I',
            '!',
        ]);
        testUtils_1.assertEqualLines(['!text']);
    }));
    test("Can handle 'a'", () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            't',
            'e',
            'x',
            't',
            't',
            'e',
            'x',
            't',
            '<Esc>',
            '^',
            'l',
            'l',
            'l',
            'l',
            'a',
            '!',
        ]);
        testUtils_1.assertEqualLines(['textt!ext']);
    }));
    test("Can handle 'A'", () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 't', 'e', 'x', 't', '<Esc>', '^', 'A', '!']);
        testUtils_1.assertEqualLines(['text!']);
    }));
    test("Can handle '<C-w>'", () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            't',
            'e',
            'x',
            't',
            ' ',
            't',
            'e',
            'x',
            't',
            '<C-w>',
        ]);
        testUtils_1.assertEqualLines(['text ']);
    }));
    newTest({
        title: 'Can handle <C-w> on leading whitespace',
        start: ['foo', '  |bar'],
        keysPressed: 'i<C-w>',
        end: ['foo', '|bar'],
    });
    newTest({
        title: 'Can handle <C-w> at beginning of line',
        start: ['foo', '|bar'],
        keysPressed: 'i<C-w>',
        end: ['foo|bar'],
    });
    newTest({
        title: 'Can handle <C-u>',
        start: ['text |text'],
        keysPressed: 'i<C-u>',
        end: ['|text'],
    });
    newTest({
        title: 'Can handle <C-u> on leading characters',
        start: ['{', '  foo: |true', '}'],
        keysPressed: 'i<C-u>',
        end: ['{', '  |true', '}'],
    });
    newTest({
        title: 'Can handle <C-u> on leading whitespace',
        start: ['{', '  |true', '}'],
        keysPressed: 'i<C-u>',
        end: ['{', '|true', '}'],
    });
    test('Correctly places the cursor after deleting the previous line break', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            'o',
            'n',
            'e',
            '\n',
            't',
            'w',
            'o',
            '<left>',
            '<left>',
            '<left>',
            '<BS>',
        ]);
        testUtils_1.assertEqualLines(['onetwo']);
        testUtils_1.assertEqual(textEditor_1.TextEditor.getSelection().start.character, 3, '<BS> moved cursor to correct position');
    }));
    test('will not remove leading spaces input by user', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', ' ', ' ', '<Esc>']);
        testUtils_1.assertEqualLines(['  ']);
    }));
    test('will remove closing bracket', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', '(', '<Esc>']);
        testUtils_1.assertEqualLines(['()']);
        yield modeHandler.handleMultipleKeyEvents(['a', '<BS>', '<Esc>']);
        testUtils_1.assertEqualLines(['']);
    }));
    newTest({
        title: 'Backspace works on whitespace only lines',
        start: ['abcd', '     |    '],
        keysPressed: 'a<BS><Esc>',
        end: ['abcd', '   | '],
    });
    newTest({
        title: 'Backspace works on end of whitespace only lines',
        start: ['abcd', '     | '],
        keysPressed: 'a<BS><Esc>',
        end: ['abcd', '   | '],
    });
    newTest({
        title: 'Backspace works at beginning of file',
        start: ['|bcd'],
        keysPressed: 'i<BS>a<Esc>',
        end: ['|abcd'],
    });
    newTest({
        title: 'Can perform <ctrl+o> to exit and perform one command in normal',
        start: ['testtest|'],
        keysPressed: 'a123<C-o>b123',
        end: ['123|testtest123'],
    });
    newTest({
        title: 'Can perform <ctrl+o> to exit and perform one command in normal at the beginning of a row',
        start: ['|testtest'],
        keysPressed: 'i<C-o>l123',
        end: ['t123|esttest'],
    });
    newTest({
        title: 'Can perform insert command prefixed with count',
        start: ['tes|t'],
        keysPressed: '2i_<Esc>',
        end: ['tes_|_t'],
    });
    newTest({
        title: 'Can perform append command prefixed with count',
        start: ['tes|t'],
        keysPressed: '3a=<Esc>',
        end: ['test==|='],
    });
    newTest({
        title: 'Can perform insert at start of line command prefixed with count',
        start: ['tes|t'],
        keysPressed: '2I_<Esc>',
        end: ['_|_test'],
    });
    newTest({
        title: 'Can perform append to end of line command prefixed with count',
        start: ['t|est'],
        keysPressed: '3A=<Esc>',
        end: ['test==|='],
    });
    newTest({
        title: 'Can perform change char (s) command prefixed with count',
        start: ['tes|ttest'],
        keysPressed: '3s=====<Esc>',
        end: ['tes====|=st'],
    });
    newTest({
        title: 'Can perform command prefixed with count with <C-[>',
        start: ['|'],
        keysPressed: '3i*<C-[>',
        end: ['**|*'],
    });
    newTest({
        title: "Can handle 'o' with count",
        start: ['|foobar'],
        keysPressed: '5ofun<Esc>',
        end: ['foobar', 'fu|n', 'fun', 'fun', 'fun', 'fun'],
    });
    newTest({
        title: "Can handle 'O' with count",
        start: ['|foobar'],
        keysPressed: '5Ofun<Esc>',
        end: ['fun', 'fun', 'fun', 'fun', 'fu|n', 'foobar'],
    });
    // This corner case caused an issue, see #3915
    newTest({
        title: 'Can handle backspace at beginning of line with all spaces',
        start: ['abc', '|     '],
        keysPressed: 'i<BS><Esc>',
        end: ['ab|c     '],
    });
    test('Can handle digraph insert', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            't',
            'e',
            'x',
            't',
            '<C-k>',
            '-',
            '>',
            't',
            'e',
            'x',
            't',
            '<C-k>',
            '>',
            '-',
        ]);
        testUtils_1.assertEqualLines(['text→text→']);
    }));
    test('Can handle custom digraph insert', () => __awaiter(this, void 0, void 0, function* () {
        globals_1.Globals.mockConfiguration.digraphs = {
            'R!': ['🚀', [55357, 56960]],
        };
        yield testUtils_1.reloadConfiguration();
        yield modeHandler.handleMultipleKeyEvents(['i', '<C-k>', 'R', '!', '<C-k>', '!', 'R']);
        testUtils_1.assertEqualLines(['🚀🚀']);
    }));
});

//# sourceMappingURL=modeInsert.test.js.map
