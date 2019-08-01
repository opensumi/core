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
const globals_1 = require("../../src/globals");
const mode_1 = require("../../src/mode/mode");
const textEditor_1 = require("../../src/textEditor");
const testSimplifier_1 = require("../testSimplifier");
const testUtils_1 = require("./../testUtils");
suite('Mode Visual', () => {
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
    newTest({
        title: 'Can handle H key',
        start: ['1', '2', '|3', '4', '5'],
        keysPressed: 'vH',
        end: ['|1', '2', '3', '4', '5'],
    });
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
        newTest({
            title: 'Paste over selection copies the selection',
            start: ['|from to'],
            keysPressed: 'dewvep0P',
            end: ['t|o from'],
        });
        newTest({
            title: 'Paste over selection copies the selection linewise',
            start: ['foo', 'bar', '|fun'],
            keysPressed: 'viwykVkpp',
            end: ['fun', '|foo', 'bar', 'fun'],
        });
    });
    suite('Arrow keys work perfectly in Visual Mode', () => {
        newTest({
            title: 'Can handle <up> key',
            start: ['blah', 'duh', '|dur', 'hur'],
            keysPressed: 'v<up>x',
            end: ['blah', '|ur', 'hur'],
        });
        newTest({
            title: 'Can handle <down> key',
            start: ['blah', 'duh', '|dur', 'hur'],
            keysPressed: 'v<down>x',
            end: ['blah', 'duh', '|ur'],
        });
        newTest({
            title: 'Can handle <left> key',
            start: ['blah', 'duh', 'd|ur', 'hur'],
            keysPressed: 'v<left>x',
            end: ['blah', 'duh', '|r', 'hur'],
        });
        newTest({
            title: 'Can handle <right> key',
            start: ['blah', 'duh', '|dur', 'hur'],
            keysPressed: 'v<right>x',
            end: ['blah', 'duh', '|r', 'hur'],
        });
    });
    suite('handles aw in visual mode', () => {
        newTest({
            title: "Can handle 'vawd' on word with cursor inside spaces",
            start: ['one   two |  three,   four  '],
            keysPressed: 'vawd',
            end: ['one   two|,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with trailing spaces",
            start: ['one   tw|o   three,   four  '],
            keysPressed: 'vawd',
            end: ['one   |three,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with leading spaces",
            start: ['one   two   th|ree,   four  '],
            keysPressed: 'vawd',
            end: ['one   two|,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with numeric prefix",
            start: ['on|e   two   three,   four  '],
            keysPressed: 'v3awd',
            end: ['|,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with numeric prefix and across lines",
            start: ['one   two   three,   fo|ur  ', 'five  six'],
            keysPressed: 'v2awd',
            end: ['one   two   three,   |six'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with numeric prefix and across lines, containing words end with `.`",
            start: ['one   two   three,   fo|ur  ', 'five.  six'],
            keysPressed: 'v2awd',
            end: ['one   two   three,   |.  six'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('handles aW in visual mode', () => {
        newTest({
            title: "Can handle 'vaWd' on big word with cursor inside spaces",
            start: ['one   two |  three,   four  '],
            keysPressed: 'vaWd',
            end: ['one   two|   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with trailing spaces",
            start: ['one   tw|o   three,   four  '],
            keysPressed: 'vaWd',
            end: ['one   |three,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with leading spaces",
            start: ['one   two   th|ree,   four  '],
            keysPressed: 'vaWd',
            end: ['one   two   |four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with numeric prefix",
            start: ['on|e   two   three,   four  '],
            keysPressed: 'v3aWd',
            end: ['|four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with numeric prefix and across lines",
            start: ['one   two   three,   fo|ur  ', 'five.  six'],
            keysPressed: 'v2aWd',
            end: ['one   two   three,   |six'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('handles aW in visual mode', () => {
        newTest({
            title: "Can handle 'vaWd' on big word with cursor inside spaces",
            start: ['one   two |  three,   four  '],
            keysPressed: 'vaWd',
            end: ['one   two|   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with trailing spaces",
            start: ['one   tw|o   three,   four  '],
            keysPressed: 'vaWd',
            end: ['one   |three,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with leading spaces",
            start: ['one   two   th|ree,   four  '],
            keysPressed: 'vaWd',
            end: ['one   two   |four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with numeric prefix",
            start: ['on|e   two   three,   four  '],
            keysPressed: 'v3aWd',
            end: ['|four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with numeric prefix and across lines",
            start: ['one   two   three,   fo|ur  ', 'five.  six'],
            keysPressed: 'v2aWd',
            end: ['one   two   three,   |six'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('handles aw in visual mode', () => {
        newTest({
            title: "Can handle 'vawd' on word with cursor inside spaces",
            start: ['one   two |  three,   four  '],
            keysPressed: 'vawd',
            end: ['one   two|,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with trailing spaces",
            start: ['one   tw|o   three,   four  '],
            keysPressed: 'vawd',
            end: ['one   |three,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with leading spaces",
            start: ['one   two   th|ree,   four  '],
            keysPressed: 'vawd',
            end: ['one   two|,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with numeric prefix",
            start: ['on|e   two   three,   four  '],
            keysPressed: 'v3awd',
            end: ['|,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with numeric prefix and across lines",
            start: ['one   two   three,   fo|ur  ', 'five  six'],
            keysPressed: 'v2awd',
            end: ['one   two   three,   |six'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vawd' on word with numeric prefix and across lines, containing words end with `.`",
            start: ['one   two   three,   fo|ur  ', 'five.  six'],
            keysPressed: 'v2awd',
            end: ['one   two   three,   |.  six'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('handles aW in visual mode', () => {
        newTest({
            title: "Can handle 'vaWd' on big word with cursor inside spaces",
            start: ['one   two |  three,   four  '],
            keysPressed: 'vaWd',
            end: ['one   two|   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with trailing spaces",
            start: ['one   tw|o   three,   four  '],
            keysPressed: 'vaWd',
            end: ['one   |three,   four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with leading spaces",
            start: ['one   two   th|ree,   four  '],
            keysPressed: 'vaWd',
            end: ['one   two   |four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with numeric prefix",
            start: ['on|e   two   three,   four  '],
            keysPressed: 'v3aWd',
            end: ['|four  '],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'vaWd' on word with numeric prefix and across lines",
            start: ['one   two   three,   fo|ur  ', 'five.  six'],
            keysPressed: 'v2aWd',
            end: ['one   two   three,   |six'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Can handle 'Y' in visual mode",
            start: ['one', '|two'],
            keysPressed: 'vwYP',
            end: ['one', '|two', 'two'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('handles as in visual mode', () => {
        newTest({
            title: 'Select sentence with trailing spaces in visual mode',
            start: ["That's my sec|ret, Captain. I'm always angry."],
            keysPressed: 'vlasd',
            end: ["That's my sec|I'm always angry."],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Select sentence with leading spaces in visual mode',
            start: ["That's my secret, Captain. I'm a|lways angry."],
            keysPressed: 'vhasd',
            end: ["That's my secret, Captain.|ways angry."],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Select multiple sentences in visual mode',
            start: ["That's my secret, Captain. I|'m always angry."],
            keysPressed: 'vhhasd',
            end: ['|m always angry.'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('handles is in visual mode', () => {
        newTest({
            title: 'Select inner sentence with trailing spaces in visual mode',
            start: ["That's my sec|ret, Captain. I'm always angry."],
            keysPressed: 'vlisd',
            end: ["That's my sec| I'm always angry."],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Select inner sentence with leading spaces in visual mode',
            start: ["That's my secret, Captain. I'm a|lways angry."],
            keysPressed: 'vhisd',
            end: ["That's my secret, Captain. |ways angry."],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Select spaces between sentences in visual mode',
            start: ["That's my secret, Captain.  |  I'm always angry."],
            keysPressed: 'vhisd',
            end: ["That's my secret, Captain.| I'm always angry."],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('handles tag blocks in visual mode', () => {
        newTest({
            title: 'Can do vit on a matching tag',
            start: ['one <blink>he|llo</blink> two'],
            keysPressed: 'vitd',
            end: ['one <blink>|</blink> two'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Count-prefixed vit alternates expanding selection between inner and outer tag brackets',
            start: ['<div> one <p> t|wo </p> three </div>'],
            keysPressed: 'v3itd',
            end: ['<div>|</div>'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Can do vat on a matching tag',
            start: ['one <blink>he|llo</blink> two'],
            keysPressed: 'vatd',
            end: ['one | two'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    newTest({
        title: 'Can do vat on multiple matching tags',
        start: ['one <blank>two <blink>he|llo</blink> three</blank> four'],
        keysPressed: 'vatatd',
        end: ['one | four'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can maintain selection on failure with vat on multiple matching tags',
        start: ['one <blank>two <blink>he|llo</blink> three</blank> four'],
        keysPressed: 'vatatatatd',
        end: ['one | four'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can maintain selection on failure with repeat-prefixed vat on multiple matching tags',
        start: ['one <blank>two <blink>he|llo</blink> three</blank> four'],
        keysPressed: 'v4atd',
        end: ['one | four'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Repeat-prefixed vat does not bleed below',
        start: ['<p>', '\t<p>', '\t|test', '\t</p>', '</p>', '', 'do not delete'],
        keysPressed: 'v8atd',
        end: ['|', '', 'do not delete'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Failed vat does not expand or move selection, remains in visual mode',
        start: ['one | two'],
        keysPressed: 'v4atd',
        end: ['one |two'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do vi) on a matching parenthesis',
        start: ['test(te|st)'],
        keysPressed: 'vi)d',
        end: ['test(|)'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do vi) on multiple matching parens',
        start: ['test(te(te|st)st)'],
        keysPressed: 'vi)i)d',
        end: ['test(|)'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do va) on a matching parenthesis',
        start: ['test(te|st);'],
        keysPressed: 'va)d',
        end: ['test|;'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do va) on multiple matching parens',
        start: ['test(te(te|st)st);'],
        keysPressed: 'va)a)d',
        end: ['test|;'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Failed va) does not expand or move selection, remains in visual mode',
        start: ['one | two'],
        keysPressed: 'v4a)d',
        end: ['one |two'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Repeat-prefixed va) does not bleed below',
        start: ['(', '\t(', '\t|', '\t)', ')', '', 'do not delete'],
        keysPressed: 'v8a)d',
        end: ['|', '', 'do not delete'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do va} on a matching bracket as first character',
        start: ['1|{', 'test', '}1'],
        keysPressed: 'va}d',
        end: ['1|1'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do va} on multiple matching brackets',
        start: ['test{te{te|st}st};'],
        keysPressed: 'va}a}d',
        end: ['test|;'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do vi( on a matching bracket near first character',
        start: ['test(()=>{', '|', '});'],
        keysPressed: 'vi(d',
        end: ['test(|);'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do vi{ on outer pair of nested braces',
        start: ['{', '  te|st', '  {', '    test', '  }', '}'],
        keysPressed: 'vi{d',
        end: ['{', '|}'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do vi{ on braces indented by 1 and preserve indent',
        start: ['{', '  t|est', ' }'],
        keysPressed: 'vi{d',
        end: ['{', '| }'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do va] on multiple matching brackets',
        start: ['test[te[te|st]st];'],
        keysPressed: 'va]a]d',
        end: ['test|;'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do repeat-prefixed vaf on multiple matching pairs of different types',
        start: ['test <div><p>[[{{((|))}}]]</p></div> test;'],
        keysPressed: 'v8afd',
        end: ['test | test;'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Repeat-prefixed vaf does not bleed below',
        start: ['<p>', '\t(', '\t|', '\t)', '</p>', '', 'do not delete'],
        keysPressed: 'v8afd',
        end: ['|', '', 'do not delete'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'vaf only expands to enclosing pairs',
        start: ['test (f|oo) "hi" test;'],
        keysPressed: 'vafd',
        end: ['test | "hi" test;'],
        endMode: mode_1.ModeName.Normal,
    });
    suite('handles replace in visual mode', () => {
        newTest({
            title: 'Can do a single line replace',
            start: ['one |two three four five'],
            keysPressed: 'vwwer1',
            end: ['one |11111111111111 five'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Can do a multi line replace',
            start: ['one |two three four five', 'one two three four five'],
            keysPressed: 'vjer1',
            end: ['one |1111111111111111111', '1111111 three four five'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    newTest({
        title: 'Can use . to repeat indent in visual',
        start: ['|foobar'],
        keysPressed: 'v>.',
        end: ['    |foobar'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do v_x to delete to first char',
        start: ['', 'test te|st test', ''],
        keysPressed: 'v_x',
        end: ['', '|t test', ''],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do vg_x to delete to last char with no EOL',
        start: ['', 'test te|st test', ''],
        keysPressed: 'vg_x',
        end: ['', 'test t|e', ''],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do v3g_x to delete to last char with no EOL with count',
        start: ['te|st', 'test', 'test', 'test'],
        keysPressed: 'v3g_x',
        end: ['t|e', 'test'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do v$x to delete to last char including EOL',
        start: ['', 'test te|st test', ''],
        keysPressed: 'v$x',
        end: ['', 'test t|e'],
        endMode: mode_1.ModeName.Normal,
    });
    newTest({
        title: 'Can do gv to reselect previous selection',
        start: ['tes|ttest'],
        keysPressed: 'vl<Esc>llgvd',
        end: ['tes|est'],
        endMode: mode_1.ModeName.Normal,
    });
    suite('D command will remove all selected lines', () => {
        newTest({
            title: 'D deletes all selected lines',
            start: ['first line', 'test| line1', 'test line2', 'second line'],
            keysPressed: 'vjD',
            end: ['first line', '|second line'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'D deletes the current line',
            start: ['first line', 'test| line1', 'second line'],
            keysPressed: 'vlllD',
            end: ['first line', '|second line'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('handles indent blocks in visual mode', () => {
        newTest({
            title: 'Can do vai',
            start: ['if foo > 3:', '    log("foo is big")|', '    foo = 3', 'do_something_else()'],
            keysPressed: 'vaid',
            end: ['|do_something_else()'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Can do vii',
            start: ['if foo > 3:', '    bar|', '    if baz:', '        foo = 3', 'do_something_else()'],
            keysPressed: 'viid',
            end: ['if foo > 3:', '|do_something_else()'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: "Doesn't naively select the next line",
            start: ['if foo > 3:', '    bar|', 'if foo > 3:', '    bar'],
            keysPressed: 'viid',
            end: ['if foo > 3:', '|if foo > 3:', '    bar'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Searches backwards if cursor line is empty',
            start: ['if foo > 3:', '    log("foo is big")', '|', '    foo = 3', 'do_something_else()'],
            keysPressed: 'viid',
            end: ['if foo > 3:', '|do_something_else()'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Can do vaI',
            start: ['if foo > 3:', '    log("foo is big")|', '    foo = 3', 'do_something_else()'],
            keysPressed: 'vaId',
            end: ['|'],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('visualstar', () => {
        setup(() => __awaiter(this, void 0, void 0, function* () {
            globals_1.Globals.mockConfiguration.visualstar = true;
            yield testUtils_1.reloadConfiguration();
        }));
        newTest({
            title: 'Works with *',
            start: [
                '|public modes = [ModeName.Visual',
                'public modes = [ModeName.VisualBlock',
                'public modes = [ModeName.VisualLine',
            ],
            // This is doing a few things:
            // - select to the end of "Visual"
            // - press "*", the cursor will go to the next line since it matches
            // - press "n", the cursor will go to the last line since it matches
            keysPressed: '2vfl*n',
            end: [
                'public modes = [ModeName.Visual',
                'public modes = [ModeName.VisualBlock',
                '|public modes = [ModeName.VisualLine',
            ],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'Works with #',
            start: [
                'public modes = [ModeName.Visual',
                'public modes = [ModeName.VisualBlock',
                '|public modes = [ModeName.VisualLine',
            ],
            // This is doing a few things:
            // - select to the end of "Visual"
            // - press "#", the cursor will go to the previous line since it matches
            // - press "n", the cursor will go to the first line since it matches
            keysPressed: '2vfl#n',
            end: [
                '|public modes = [ModeName.Visual',
                'public modes = [ModeName.VisualBlock',
                'public modes = [ModeName.VisualLine',
            ],
            endMode: mode_1.ModeName.Normal,
        });
    });
    suite('search works in visual mode', () => {
        newTest({
            title: 'Works with /',
            start: ['f|oo', 'bar', 'fun', 'baz'],
            keysPressed: 'v/baz\nx',
            end: ['f|az'],
        });
        newTest({
            title: 'Works with ?',
            start: ['foo', 'bar', 'fun', 'b|az'],
            keysPressed: 'v?foo\nx',
            end: ['|z'],
        });
        test('Selects correct range', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ifoo bar fun baz'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g', 'v', 'w', '/']);
            const selection = textEditor_1.TextEditor.getSelection();
            // ensuring selection range starts from the beginning
            testUtils_1.assertEqual(selection.start.character, 0);
            testUtils_1.assertEqual(selection.start.line, 0);
            testUtils_1.assertEqual(selection.end.character, 4);
            testUtils_1.assertEqual(selection.end.line, 0);
        }));
    });
    suite('X will delete linewise', () => {
        newTest({
            title: 'normal selection',
            start: ['this is', 'the| best', 'test i have seen in', 'the world'],
            keysPressed: 'vjX',
            end: ['this is', '|the world'],
        });
        newTest({
            title: 'normal selection',
            start: ['this is', 'the| best', 'test i have seen in', 'the world'],
            keysPressed: 'vj$X',
            end: ['this is', '|the world'],
        });
    });
    suite('C will delete linewise', () => {
        newTest({
            title: 'normal selection',
            start: ['this is', 'the| best', 'test i have seen in', 'the world'],
            keysPressed: 'vjC',
            end: ['this is', '|', 'the world'],
        });
        newTest({
            title: 'normal selection',
            start: ['this is', 'the| best', 'test i have seen in', 'the world'],
            keysPressed: 'vj$C',
            end: ['this is', '|', 'the world'],
        });
    });
    suite('R will delete linewise', () => {
        newTest({
            title: 'normal selection',
            start: ['this is', 'the| best', 'test i have seen in', 'the world'],
            keysPressed: 'vjR',
            end: ['this is', '|', 'the world'],
        });
        newTest({
            title: 'normal selection',
            start: ['this is', 'the| best', 'test i have seen in', 'the world'],
            keysPressed: 'vj$R',
            end: ['this is', '|', 'the world'],
        });
    });
    suite('Linewise Registers will be inserted properly', () => {
        newTest({
            title: 'downward selection',
            start: ['i ya|nked', 'this line', '', '1.line', 'a123456', 'b123456', '2.line'],
            keysPressed: 'vjY4j3lvjllp',
            end: ['i yanked', 'this line', '', '1.line', 'a12', '|i yanked', 'this line', '6', '2.line'],
        });
        newTest({
            title: 'upward selection',
            start: ['i yanked', 'this| line', '', '1.line', 'a123456', 'b123456', '2.line'],
            keysPressed: 'vkY4j3lvjllp',
            end: ['i yanked', 'this line', '', '1.line', 'a12', '|i yanked', 'this line', '6', '2.line'],
        });
    });
    suite('Indent Tests using > on visual selections', () => {
        newTest({
            title: 'multiline indent top down selection',
            start: ['111', '2|22', '333', '444', '555'],
            keysPressed: 'Vjj>',
            end: ['111', '  |222', '  333', '  444', '555'],
        });
        newTest({
            title: 'multiline indent bottom up selection',
            start: ['111', '222', '333', '4|44', '555'],
            keysPressed: 'Vkk>',
            end: ['111', '  |222', '  333', '  444', '555'],
        });
        newTest({
            title: 'repeat multiline indent top down selection',
            start: ['111', '2|22', '333', '444', '555'],
            keysPressed: 'Vjj>.',
            end: ['111', '    |222', '    333', '    444', '555'],
        });
        newTest({
            title: 'repeat multiline indent bottom up selection',
            start: ['111', '222', '333', '4|44', '555'],
            keysPressed: 'Vkk>.',
            end: ['111', '    |222', '    333', '    444', '555'],
        });
    });
    suite('Outdent Tests using < on visual selections', () => {
        newTest({
            title: 'multiline outdent top down selection',
            start: ['    111', '    2|22', '    333', '   444', '    555'],
            keysPressed: 'Vjj<',
            end: ['    111', '  |222', '  333', '  444', '    555'],
        });
        newTest({
            title: 'multiline outdent bottom up selection',
            start: ['    111', '    222', '    333', '   4|44', '    555'],
            keysPressed: 'Vkk<',
            end: ['    111', '  |222', '  333', '  444', '    555'],
        });
        newTest({
            title: 'repeat multiline outdent top down selection',
            start: ['    111', '    2|22', '    333', '   444', '    555'],
            keysPressed: 'Vjj<.',
            end: ['    111', '|222', '333', '444', '    555'],
        });
        newTest({
            title: 'repeat multiline outdent bottom up selection',
            start: ['    111', '    222', '    333', '   4|44', '    555'],
            keysPressed: 'Vkk<.',
            end: ['    111', '|222', '333', '444', '    555'],
        });
    });
    suite('Non-darwin <C-c> tests', () => {
        if (process.platform === 'darwin') {
            return;
        }
        test('<C-c> copies and sets mode to normal', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ione two three'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', '^', 'v', 'e', '<C-c>']);
            // ensuring we're back in normal
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
            testUtils_1.assertEqualLines(['one two three']);
            // test copy by pasting back
            yield modeHandler.handleMultipleKeyEvents(['^', '"', '+', 'P']);
            testUtils_1.assertEqualLines(['oneone two three']);
        }));
    });
    suite('vi{ will go to end of second to last line', () => {
        newTest({
            title: 'select',
            start: ['    func() {', '    |    hi;', '        alw;', '    }'],
            keysPressed: 'vi{yGP',
            end: ['    func() {', '        hi;', '        alw;', '|        hi;', '        alw;', '    }'],
        });
    });
    suite('Transition between visual mode', () => {
        test('vv will back to normal mode', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            yield modeHandler.handleMultipleKeyEvents(['v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        }));
        test('vV will transit to visual line mode', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            yield modeHandler.handleMultipleKeyEvents(['V']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualLine);
        }));
        test('v<C-v> will transit to visual block mode', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            yield modeHandler.handleMultipleKeyEvents(['<C-v>']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualBlock);
        }));
        test('Vv will transit to visual (char) mode', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['V']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualLine);
            yield modeHandler.handleMultipleKeyEvents(['v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
        }));
        test('VV will back to normal mode', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['V']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualLine);
            yield modeHandler.handleMultipleKeyEvents(['V']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        }));
        test('V<C-v> will transit to visual block mode', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['V']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualLine);
            yield modeHandler.handleMultipleKeyEvents(['<C-v>']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualBlock);
        }));
        test('<C-v>v will transit to visual (char) mode', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['<C-v>']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualBlock);
            yield modeHandler.handleMultipleKeyEvents(['v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
        }));
        test('<C-v>V will back to visual line mode', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['<C-v>']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualBlock);
            yield modeHandler.handleMultipleKeyEvents(['V']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualLine);
        }));
        test('<C-v><C-v> will back to normal mode', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['<C-v>']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.VisualBlock);
            yield modeHandler.handleMultipleKeyEvents(['<C-v>']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        }));
    });
    suite('replace text in characterwise visual-mode with characterwise register content', () => {
        test('gv selects the last pasted text (which is shorter than original)', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ireplace this\nwith me\nor with me longer than the target'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>']);
            yield modeHandler.handleMultipleKeyEvents('2ggv$hy'.split('') // yank the second line
            );
            yield modeHandler.handleMultipleKeyEvents('ggv$hp'.split('') // replace the first line
            );
            yield modeHandler.handleMultipleKeyEvents(['g', 'v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
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
            yield modeHandler.handleMultipleKeyEvents('v0y'.split('') // yank the last line
            );
            yield modeHandler.handleMultipleKeyEvents('ggv$hp'.split('') // replace the first line
            );
            yield modeHandler.handleMultipleKeyEvents(['g', 'v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
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
            yield modeHandler.handleMultipleKeyEvents('2ggvjey'.split('') // yank 'foo\nbar'
            );
            yield modeHandler.handleMultipleKeyEvents('ggvep'.split('') // replace 'replace'
            );
            yield modeHandler.handleMultipleKeyEvents(['g', 'v']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            testUtils_1.assertEqualLines(['foo', 'bar this', 'foo', 'bar']);
            const selection = textEditor_1.TextEditor.getSelection();
            // ensuring selecting 'foo\nbar'
            testUtils_1.assertEqual(selection.start.character, 0);
            testUtils_1.assertEqual(selection.start.line, 0);
            testUtils_1.assertEqual(selection.end.character, 3);
            testUtils_1.assertEqual(selection.end.line, 1);
        }));
    });
    suite('can handle gn', () => {
        test('gn selects the next match text', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ifoo\nhello world\nhello\nhello'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', ...'/hello\n'.split('')]);
            yield modeHandler.handleMultipleKeyEvents('ggv'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['g', 'n']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            const selection = textEditor_1.TextEditor.getSelection();
            testUtils_1.assertEqual(selection.start.character, 0);
            testUtils_1.assertEqual(selection.start.line, 0);
            testUtils_1.assertEqual(selection.end.character, 'hello'.length);
            testUtils_1.assertEqual(selection.end.line, 1);
        }));
        test('gn selects the current word at |hello', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ifoo\nhello world\nhello\nhello'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', ...'/hello\n'.split('')]);
            yield modeHandler.handleMultipleKeyEvents('2ggv'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['g', 'n']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            const selection = textEditor_1.TextEditor.getSelection();
            testUtils_1.assertEqual(selection.start.character, 0);
            testUtils_1.assertEqual(selection.start.line, 1);
            testUtils_1.assertEqual(selection.end.character, 5);
            testUtils_1.assertEqual(selection.end.line, 1);
        }));
        test('gn selects the current word at h|ello', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ifoo\nhello world\nhello\nhello'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', ...'/hello\n'.split('')]);
            yield modeHandler.handleMultipleKeyEvents('2gglv'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['g', 'n']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            const selection = textEditor_1.TextEditor.getSelection();
            testUtils_1.assertEqual(selection.start.character, 1);
            testUtils_1.assertEqual(selection.start.line, 1);
            testUtils_1.assertEqual(selection.end.character, 5);
            testUtils_1.assertEqual(selection.end.line, 1);
        }));
        test('gn selects the current word at hel|lo', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ifoo\nhello world\nhello\nhello'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', ...'/hello\n'.split('')]);
            yield modeHandler.handleMultipleKeyEvents('2ggehv'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['g', 'n']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            const selection = textEditor_1.TextEditor.getSelection();
            testUtils_1.assertEqual(selection.start.character, 3);
            testUtils_1.assertEqual(selection.start.line, 1);
            testUtils_1.assertEqual(selection.end.character, 5);
            testUtils_1.assertEqual(selection.end.line, 1);
        }));
        test('gn selects the next word at hell|o', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ifoo\nhello world\nhello\nhello'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', ...'/hello\n'.split('')]);
            yield modeHandler.handleMultipleKeyEvents('2ggev'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['g', 'n']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            const selection = textEditor_1.TextEditor.getSelection();
            testUtils_1.assertEqual(selection.start.character, 4);
            testUtils_1.assertEqual(selection.start.line, 1);
            testUtils_1.assertEqual(selection.end.character, 5);
            testUtils_1.assertEqual(selection.end.line, 2);
        }));
        test('gn selects the next word at hello|', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents('ifoo\nhello world\nhello\nhello'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['<Esc>', ...'/hello\n'.split('')]);
            yield modeHandler.handleMultipleKeyEvents('2ggelv'.split(''));
            yield modeHandler.handleMultipleKeyEvents(['g', 'n']);
            testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
            const selection = textEditor_1.TextEditor.getSelection();
            testUtils_1.assertEqual(selection.start.character, 5);
            testUtils_1.assertEqual(selection.start.line, 1);
            testUtils_1.assertEqual(selection.end.character, 5);
            testUtils_1.assertEqual(selection.end.line, 2);
        }));
    });
    suite('can prepend text with I', () => {
        newTest({
            title: 'multiline insert from bottom up selection',
            start: ['111', '222', '333', '4|44', '555'],
            keysPressed: 'vkkI_',
            end: ['111', '2_|22', '_333', '_444', '555'],
        });
        newTest({
            title: 'multiline insert from top down selection',
            start: ['111', '2|22', '333', '444', '555'],
            keysPressed: 'vjjI_',
            end: ['111', '2_|22', '_333', '_444', '555'],
        });
        newTest({
            title: 'skips blank lines',
            start: ['111', '2|22', ' ', '444', '555'],
            keysPressed: 'vjjI_',
            end: ['111', '2_|22', ' ', '_444', '555'],
        });
    });
    suite('can append text with A', () => {
        newTest({
            title: 'multiline append from bottom up selection',
            start: ['111', '222', '333', '4|44', '555'],
            keysPressed: 'vkkA_',
            end: ['111', '222_|', '333_', '44_4', '555'],
        });
        newTest({
            title: 'multiline append from top down selection',
            start: ['111', '2|22', '333', '444', '555'],
            keysPressed: 'vjjA_',
            end: ['111', '222_|', '333_', '44_4', '555'],
        });
        newTest({
            title: 'skips blank lines',
            start: ['111', '2|22', ' ', '444', '555'],
            keysPressed: 'vjjA_',
            end: ['111', '222_|', ' ', '44_4', '555'],
        });
    });
    suite('Can handle u/gu, U/gU', () => {
        newTest({
            title: 'U/gU on single character',
            start: ['|one two three'],
            keysPressed: 'vUwwvgU',
            end: ['One two |Three'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'U/gU across a selection',
            start: ['|one two three'],
            keysPressed: 'vllllUwwvlgU',
            end: ['ONE Two |THree'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'U/gU across a selection (reverse)',
            start: ['|one two three'],
            keysPressed: 'wvhhUwwvhhgU',
            end: ['onE Tw|O Three'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'u/gu on single character',
            start: ['|ONE TWO THREE'],
            keysPressed: 'vuwwvgu',
            end: ['oNE TWO |tHREE'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'u/gu across a selection',
            start: ['|ONE TWO THREE'],
            keysPressed: 'vlllluwwvlgu',
            end: ['one tWO |thREE'],
            endMode: mode_1.ModeName.Normal,
        });
        newTest({
            title: 'u/gu across a selection (reverse)',
            start: ['|ONE TWO THREE'],
            keysPressed: 'wvhhuwwvhhgu',
            end: ['ONe tW|o tHREE'],
            endMode: mode_1.ModeName.Normal,
        });
    });
});

//# sourceMappingURL=modeVisual.test.js.map
