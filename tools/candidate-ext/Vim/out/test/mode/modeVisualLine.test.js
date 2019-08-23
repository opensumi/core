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
const mode_1 = require("../../src/mode/mode");
const textEditor_1 = require("../../src/textEditor");
const testSimplifier_1 = require("../testSimplifier");
const testUtils_1 = require("./../testUtils");
suite('Mode Visual Line', () => {
    let modeHandler;
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('can be activated', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleKeyEvent('v');
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
        yield modeHandler.handleKeyEvent('v');
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
    }));
    test('Can handle w', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('itest test test\ntest\n'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g', 'v', 'w']);
        const sel = textEditor_1.TextEditor.getSelection();
        assert.equal(sel.start.character, 0);
        assert.equal(sel.start.line, 0);
        // The input cursor comes BEFORE the block cursor. Try it out, this
        // is how Vim works.
        assert.equal(sel.end.character, 6);
        assert.equal(sel.end.line, 0);
    }));
    test('Can handle wd', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('ione two three'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', '^', 'v', 'w', 'd']);
        testUtils_1.assertEqualLines(['wo three']);
    }));
    test('Can handle x', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('ione two three'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', '^', 'v', 'x']);
        testUtils_1.assertEqualLines(['ne two three']);
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
    }));
    test('Can handle x across a selection', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('ione two three'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', '^', 'v', 'w', 'x']);
        testUtils_1.assertEqualLines(['wo three']);
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
    }));
    test('Can do vwd in middle of sentence', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('ione two three foar'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', '^', 'l', 'l', 'l', 'l', 'v', 'w', 'd']);
        testUtils_1.assertEqualLines(['one hree foar']);
    }));
    test('Can do vwd in middle of sentence', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('ione two three'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', '^', 'l', 'l', 'l', 'l', 'v', 'w', 'd']);
        testUtils_1.assertEqualLines(['one hree']);
    }));
    test('Can do vwd multiple times', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('ione two three four'.split(''));
        yield modeHandler.handleMultipleKeyEvents([
            '<Esc>',
            '^',
            'v',
            'w',
            'd',
            'v',
            'w',
            'd',
            'v',
            'w',
            'd',
        ]);
        testUtils_1.assertEqualLines(['our']);
    }));
    test('handles case where we go from selecting on right side to selecting on left side', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('ione two three'.split(''));
        yield modeHandler.handleMultipleKeyEvents([
            '<Esc>',
            '^',
            'l',
            'l',
            'l',
            'l',
            'v',
            'w',
            'b',
            'b',
            'd',
        ]);
        testUtils_1.assertEqualLines(['wo three']);
    }));
    test('handles case where we delete over a newline', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('ione two\n\nthree four'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', '0', 'k', 'k', 'v', '}', 'd']);
        testUtils_1.assertEqualLines(['three four']);
    }));
    test('handles change operator', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('ione two three'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', '^', 'v', 'w', 'c']);
        testUtils_1.assertEqualLines(['wo three']);
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Insert);
    }));
    suite("Vim's EOL handling is weird", () => {
        test('delete through eol', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ione\ntwo'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', '^', 'g', 'g', 'v', 'l', 'l', 'l', 'd']);
            testUtils_1.assertEqualLines(['two']);
        }));
        test('join 2 lines by deleting through eol', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ione\ntwo'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g', 'l', 'v', 'l', 'l', 'd']);
            testUtils_1.assertEqualLines(['otwo']);
        }));
        test("d$ doesn't delete whole line", () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ione\ntwo'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g', 'd', '$']);
            testUtils_1.assertEqualLines(['', 'two']);
        }));
        test('vd$ does delete whole line', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ione\ntwo'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g', 'v', '$', 'd']);
            testUtils_1.assertEqualLines(['two']);
        }));
    });
    suite('Arrow keys work perfectly in Visual Line Mode', () => {
        newTest({
            title: 'Can handle <up> key',
            start: ['blah', 'duh', '|dur', 'hur'],
            keysPressed: 'V<up>x',
            end: ['blah', '|hur'],
        });
        newTest({
            title: 'Can handle <down> key',
            start: ['blah', 'duh', '|dur', 'hur'],
            keysPressed: 'V<down>x',
            end: ['blah', '|duh'],
        });
    });
    suite('Can handle d/c correctly in Visual Line Mode', () => {
        newTest({
            title: 'Can handle d key',
            start: ['|{', '  a = 1;', '}'],
            keysPressed: 'VGdp',
            end: ['', '|{', '  a = 1;', '}'],
        });
        newTest({
            title: 'Can handle d key',
            start: ['|{', '  a = 1;', '}'],
            keysPressed: 'VGdP',
            end: ['|{', '  a = 1;', '}', ''],
        });
        newTest({
            title: 'Can handle d key',
            start: ['1', '2', '|{', '  a = 1;', '}'],
            keysPressed: 'VGdp',
            end: ['1', '2', '|{', '  a = 1;', '}'],
        });
        newTest({
            title: 'Can handle d key',
            start: ['1', '2', '|{', '  a = 1;', '}'],
            keysPressed: 'VGdP',
            end: ['1', '|{', '  a = 1;', '}', '2'],
        });
        newTest({
            title: "can handle 'c'",
            start: ['foo', 'b|ar', 'fun'],
            keysPressed: 'Vc',
            end: ['foo', '|', 'fun'],
            endMode: mode_1.ModeName.Insert,
        });
    });
    suite('handles replace in visual line mode', () => {
        newTest({
            title: 'Can do a single line replace',
            start: ['one |two three four five', 'one two three four five'],
            keysPressed: 'Vr1',
            end: ['|11111111111111111111111', 'one two three four five'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Can do a multi visual line replace',
            start: ['one |two three four five', 'one two three four five'],
            keysPressed: 'Vjr1',
            end: ['|11111111111111111111111', '11111111111111111111111'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Can do a multi visual line replace from the bottom up',
            start: ['test', 'test', 'test', '|test', 'test'],
            keysPressed: 'Vkkr1',
            end: ['test', '|1111', '1111', '1111', 'test'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('search works in visual line mode', () => {
        newTest({
            title: 'Works with /',
            start: ['f|oo', 'bar', 'fun', 'baz'],
            keysPressed: 'V/fun\nx',
            end: ['|baz'],
        });
        newTest({
            title: 'Works with ?',
            start: ['foo', 'bar', 'fun', 'b|az'],
            keysPressed: 'V?bar\nx',
            end: ['|foo'],
        });
    });
    suite('Non-darwin <C-c> tests', () => {
        if (process.platform === 'darwin') {
            return;
        }
        test('<C-c> copies and sets mode to normal', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ione two three'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'Y', 'p']);
            testUtils_1.assertEqualLines(['one two three', 'one two three']);
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'H', 'V', '<C-c>']);
            // ensuring we're back in normal
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
            // test copy by pasting back from clipboard
            yield modeHandler.handleMultipleKeyEvents(['H', '"', '+', 'P']);
            // TODO: should be assertEqualLines(['one two three', 'one two three', 'one two three']);
            // unfortunately it is
            testUtils_1.assertEqualLines(['one two threeone two three', 'one two three']);
        }));
    });
    newTest({
        title: 'Vp updates register content',
        start: ['|hello', 'world'],
        keysPressed: 'ddVpP',
        end: ['|world', 'hello'],
    });
    newTest({
        title: 'Vp does not append unnecessary newlines (first line)',
        start: ['|begin', 'middle', 'end'],
        keysPressed: 'yyVp',
        end: ['|begin', 'middle', 'end'],
    });
    newTest({
        title: 'Vp does not append unnecessary newlines (middle line)',
        start: ['begin', '|middle', 'end'],
        keysPressed: 'yyVp',
        end: ['begin', '|middle', 'end'],
    });
    newTest({
        title: 'Vp does not append unnecessary newlines (last line)',
        start: ['begin', 'middle', '|end'],
        keysPressed: 'yyVp',
        end: ['begin', 'middle', '|end'],
    });
    suite('replace text in linewise visual-mode with linewise register content', () => {
        newTest({
            title: 'yyVp does not change the content but changes cursor position',
            start: ['fo|o', 'bar', 'fun', 'baz'],
            keysPressed: 'yyVp',
            end: ['|foo', 'bar', 'fun', 'baz'],
        });
        newTest({
            title: 'linewise visual put works also in the end of document',
            start: ['foo', 'bar', 'fun', '|baz'],
            keysPressed: 'yyVp',
            end: ['foo', 'bar', 'fun', '|baz'],
        });
        test('gv selects the last pasted text (which is shorter than original)', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ireplace this\nwith me\nor with me longer than the target'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>']);
            yield modeHandler.handleMultipleKeyEvents('2ggyy'.split('') // yank the second line
            );
            yield modeHandler.handleMultipleKeyEvents('ggVp'.split('') // replace the first line
            );
            yield modeHandler.handleMultipleKeyEvents(['g', 'v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualLine);
            testUtils_1.assertEqualLines(['with me', 'with me', 'or with me longer than the target']);
            const selection = textEditor_1.TextEditor.getSelection();
            // ensuring selecting 'with me' at the first line
            testUtils_1.assertEqual(selection.start.character, 0);
            testUtils_1.assertEqual(selection.start.line, 0);
            testUtils_1.assertEqual(selection.end.character, 'with me'.length);
            testUtils_1.assertEqual(selection.end.line, 0);
        }));
        test('gv selects the last pasted text (which is longer than original)', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ireplace this\nwith me\nor with me longer than the target'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>']);
            yield modeHandler.handleMultipleKeyEvents('yy'.split('') // yank the last line
            );
            yield modeHandler.handleMultipleKeyEvents('ggVp'.split('') // replace the first line
            );
            yield modeHandler.handleMultipleKeyEvents(['g', 'v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualLine);
            testUtils_1.assertEqualLines([
                'or with me longer than the target',
                'with me',
                'or with me longer than the target',
            ]);
            const selection = textEditor_1.TextEditor.getSelection();
            // ensuring selecting 'or with me longer than the target' at the first line
            testUtils_1.assertEqual(selection.start.character, 0);
            testUtils_1.assertEqual(selection.start.line, 0);
            testUtils_1.assertEqual(selection.end.character, 'or with me longer than the target'.length);
            testUtils_1.assertEqual(selection.end.line, 0);
        }));
        test('gv selects the last pasted text (multiline)', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ireplace this\nfoo\nbar'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>']);
            yield modeHandler.handleMultipleKeyEvents('Vky'.split('') // yank 'foo\nbar\n'
            );
            yield modeHandler.handleMultipleKeyEvents('ggVp'.split('') // replace the first line
            );
            yield modeHandler.handleMultipleKeyEvents(['g', 'v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualLine);
            testUtils_1.assertEqualLines(['foo', 'bar', 'foo', 'bar']);
            const selection = textEditor_1.TextEditor.getSelection();
            // ensuring selecting 'foo\nbar\n'
            testUtils_1.assertEqual(selection.start.character, 0);
            testUtils_1.assertEqual(selection.start.line, 0);
            testUtils_1.assertEqual(selection.end.character, 3);
            testUtils_1.assertEqual(selection.end.line, 1);
        }));
    });
    suite('can prepend text with I', () => {
        newTest({
            title: 'multiline insert from bottom up selection',
            start: ['111', '222', '333', '4|44', '555'],
            keysPressed: 'VkkI_',
            end: ['111', '_|222', '_333', '_444', '555'],
        });
        newTest({
            title: 'multiline insert from top down selection',
            start: ['111', '2|22', '333', '444', '555'],
            keysPressed: 'VjjI_',
            end: ['111', '_|222', '_333', '_444', '555'],
        });
        newTest({
            title: 'skips blank lines',
            start: ['111', '2|22', ' ', '444', '555'],
            keysPressed: 'VjjI_',
            end: ['111', '_|222', ' ', '_444', '555'],
        });
    });
    suite('can append text with A', () => {
        newTest({
            title: 'multiline append from bottom up selection',
            start: ['111', '222', '333', '4|44', '555'],
            keysPressed: 'VkkA_',
            end: ['111', '222_|', '333_', '444_', '555'],
        });
        newTest({
            title: 'multiline append from top down selection',
            start: ['111', '2|22', '333', '444', '555'],
            keysPressed: 'VjjA_',
            end: ['111', '222_|', '333_', '444_', '555'],
        });
        newTest({
            title: 'skips blank lines',
            start: ['111', '2|22', ' ', '444', '555'],
            keysPressed: 'VjjA_',
            end: ['111', '222_|', ' ', '444_', '555'],
        });
    });
});

//# sourceMappingURL=modeVisualLine.test.js.map
