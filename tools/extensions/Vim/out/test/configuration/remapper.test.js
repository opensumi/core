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
const remapper_1 = require("../../src/configuration/remapper");
const mode_1 = require("../../src/mode/mode");
const testConfiguration_1 = require("../testConfiguration");
const testUtils_1 = require("../testUtils");
const register_1 = require("../../src/register/register");
const extension_1 = require("../../extension");
/* tslint:disable:no-string-literal */
suite('Remapper', () => {
    let modeHandler;
    let vimState;
    const leaderKey = '\\';
    const defaultInsertModeKeyBindings = [
        {
            before: ['j', 'j'],
            after: ['<Esc>'],
        },
        {
            before: ['<c-e>'],
            after: ['<Esc>'],
        },
    ];
    const defaultNormalModeKeyBindings = [
        {
            before: ['leader', 'w'],
            commands: [
                {
                    command: 'workbench.action.closeActiveEditor',
                    args: [],
                },
            ],
        },
        {
            before: ['0'],
            commands: [
                {
                    command: ':wq',
                    args: [],
                },
            ],
        },
        {
            before: ['d'],
            after: ['"', '_', 'd'],
        },
        {
            before: ['y', 'y'],
            after: ['y', 'l'],
        },
        {
            before: ['e'],
            after: ['$'],
        },
    ];
    const defaultVisualModeKeyBindings = [
        {
            before: ['leader', 'c'],
            commands: [
                {
                    command: 'workbench.action.closeActiveEditor',
                    args: [],
                },
            ],
        },
    ];
    class TestRemapper extends remapper_1.Remapper {
        constructor() {
            super('configKey', [mode_1.ModeName.Insert], false);
        }
        findMatchingRemap(userDefinedRemappings, inputtedKeys, currentMode) {
            return super.findMatchingRemap(userDefinedRemappings, inputtedKeys, currentMode);
        }
        getRemappedKeySequenceLengthRange(remappings) {
            return TestRemapper.getRemappedKeysLengthRange(remappings);
        }
    }
    const setupWithBindings = ({ insertModeKeyBindings, normalModeKeyBindings, visualModeKeyBindings, }) => __awaiter(this, void 0, void 0, function* () {
        let configuration = new testConfiguration_1.Configuration();
        configuration.leader = leaderKey;
        configuration.insertModeKeyBindings = insertModeKeyBindings || [];
        configuration.normalModeKeyBindings = normalModeKeyBindings || [];
        configuration.visualModeKeyBindings = visualModeKeyBindings || [];
        yield testUtils_1.setupWorkspace(configuration);
        modeHandler = yield extension_1.getAndUpdateModeHandler();
        vimState = modeHandler.vimState;
    });
    teardown(testUtils_1.cleanUpWorkspace);
    test('getLongestedRemappedKeySequence', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        yield setupWithBindings({
            insertModeKeyBindings: defaultInsertModeKeyBindings,
            normalModeKeyBindings: defaultNormalModeKeyBindings,
            visualModeKeyBindings: defaultVisualModeKeyBindings,
        });
        let remappings = new Map([
            ['abc', { before: ['a', 'b', 'c'] }],
            ['de', { before: ['d', 'e'] }],
            ['f', { before: ['f'] }],
        ]);
        // act
        const testRemapper = new TestRemapper();
        const actual = testRemapper.getRemappedKeySequenceLengthRange(remappings);
        // assert
        assert.equal(actual[0], 1);
        assert.equal(actual[1], 3);
    }));
    test('getMatchingRemap', () => __awaiter(this, void 0, void 0, function* () {
        yield setupWithBindings({
            insertModeKeyBindings: defaultInsertModeKeyBindings,
            normalModeKeyBindings: defaultNormalModeKeyBindings,
            visualModeKeyBindings: defaultVisualModeKeyBindings,
        });
        const testCases = [
            {
                // able to match number in normal mode
                before: '0',
                after: ':wq',
                input: '0',
                mode: mode_1.ModeName.Normal,
                expectedAfter: ':wq',
            },
            {
                // able to match characters in normal mode
                before: 'abc',
                after: ':wq',
                input: 'abc',
                mode: mode_1.ModeName.Normal,
                expectedAfter: ':wq',
            },
            {
                // able to match with preceding count in normal mode
                before: 'abc',
                after: ':wq',
                input: '0abc',
                mode: mode_1.ModeName.Normal,
                expectedAfter: ':wq',
            },
            {
                // must match exactly in normal mode
                before: 'abc',
                after: ':wq',
                input: 'defabc',
                mode: mode_1.ModeName.Normal,
            },
            {
                // able to match in insert mode
                before: 'jj',
                after: '<Esc>',
                input: 'jj',
                mode: mode_1.ModeName.Insert,
                expectedAfter: '<Esc>',
                expectedAfterMode: mode_1.ModeName.Normal,
            },
            {
                // able to match with preceding keystrokes in insert mode
                before: 'jj',
                after: '<Esc>',
                input: 'hello world jj',
                mode: mode_1.ModeName.Insert,
                expectedAfter: '<Esc>',
                expectedAfterMode: mode_1.ModeName.Normal,
            },
            {
                // able to match with preceding keystrokes in insert mode
                before: 'jj',
                after: '<Esc>',
                input: 'ifoo<Esc>ciwjj',
                mode: mode_1.ModeName.Insert,
                expectedAfter: '<Esc>',
                expectedAfterMode: mode_1.ModeName.Normal,
            },
        ];
        for (const testCase of testCases) {
            // setup
            let remappings = new Map();
            remappings.set(testCase.before, {
                before: testCase.before.split(''),
                after: testCase.after.split(''),
            });
            // act
            const testRemapper = new TestRemapper();
            const actual = testRemapper.findMatchingRemap(remappings, testCase.input.split(''), testCase.mode);
            // assert
            if (testCase.expectedAfter) {
                assert(actual, `Expected remap for before=${testCase.before}. input=${testCase.input}. mode=${mode_1.ModeName[testCase.mode]}.`);
                assert.deepEqual(actual.after, testCase.expectedAfter.split(''));
            }
            else {
                assert.equal(actual, undefined);
            }
            if (testCase.expectedAfterMode) {
                testUtils_1.assertEqual(modeHandler.currentMode.name, testCase.expectedAfterMode);
                testUtils_1.assertEqual(modeHandler.vimState.currentMode, testCase.expectedAfterMode);
            }
        }
    }));
    test('jj -> <Esc> through modehandler', () => __awaiter(this, void 0, void 0, function* () {
        const expectedDocumentContent = 'lorem ipsum';
        // setup
        yield setupWithBindings({
            insertModeKeyBindings: defaultInsertModeKeyBindings,
            normalModeKeyBindings: defaultNormalModeKeyBindings,
            visualModeKeyBindings: defaultVisualModeKeyBindings,
        });
        let remapper = new remapper_1.Remappers();
        const edit = new vscode.WorkspaceEdit();
        edit.insert(vscode.window.activeTextEditor.document.uri, new vscode.Position(0, 0), expectedDocumentContent);
        vscode.workspace.applyEdit(edit);
        yield modeHandler.handleKeyEvent('i');
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Insert);
        // act
        let actual = false;
        try {
            actual = yield remapper.sendKey(['j', 'j'], modeHandler, modeHandler.vimState);
        }
        catch (e) {
            assert.fail(e);
        }
        // assert
        assert.equal(actual, true);
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        assert.equal(vscode.window.activeTextEditor.document.getText(), expectedDocumentContent);
    }));
    test('0 -> :wq through modehandler', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        yield setupWithBindings({
            insertModeKeyBindings: defaultInsertModeKeyBindings,
            normalModeKeyBindings: defaultNormalModeKeyBindings,
            visualModeKeyBindings: defaultVisualModeKeyBindings,
        });
        let remapper = new remapper_1.Remappers();
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        // act
        let actual = false;
        try {
            actual = yield remapper.sendKey(['0'], modeHandler, modeHandler.vimState);
        }
        catch (e) {
            assert.fail(e);
        }
        // assert
        assert.equal(actual, true);
        assert.equal(vscode.window.visibleTextEditors.length, 0);
    }));
    test('<c-e> -> <esc> in insert mode should go to normal mode', () => __awaiter(this, void 0, void 0, function* () {
        const expectedDocumentContent = 'lorem ipsum';
        // setup
        yield setupWithBindings({
            insertModeKeyBindings: defaultInsertModeKeyBindings,
            normalModeKeyBindings: defaultNormalModeKeyBindings,
            visualModeKeyBindings: defaultVisualModeKeyBindings,
        });
        let remapper = new remapper_1.Remappers();
        const edit = new vscode.WorkspaceEdit();
        edit.insert(vscode.window.activeTextEditor.document.uri, new vscode.Position(0, 0), expectedDocumentContent);
        vscode.workspace.applyEdit(edit);
        yield modeHandler.handleKeyEvent('i');
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Insert);
        // act
        let actual = false;
        try {
            actual = yield remapper.sendKey(['<C-e>'], modeHandler, modeHandler.vimState);
        }
        catch (e) {
            assert.fail(e);
        }
        // assert
        assert.equal(actual, true);
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        assert.equal(vscode.window.activeTextEditor.document.getText(), expectedDocumentContent);
    }));
    test('leader, w -> closeActiveEditor in normal mode through modehandler', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        yield setupWithBindings({
            insertModeKeyBindings: defaultInsertModeKeyBindings,
            normalModeKeyBindings: defaultNormalModeKeyBindings,
            visualModeKeyBindings: defaultVisualModeKeyBindings,
        });
        let remapper = new remapper_1.Remappers();
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        // act
        let actual = false;
        try {
            actual = yield remapper.sendKey([leaderKey, 'w'], modeHandler, modeHandler.vimState);
        }
        catch (e) {
            assert.fail(e);
        }
        // assert
        assert.equal(actual, true);
        assert.equal(vscode.window.visibleTextEditors.length, 0);
    }));
    test('leader, c -> closeActiveEditor in visual mode through modehandler', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        yield setupWithBindings({
            insertModeKeyBindings: defaultInsertModeKeyBindings,
            normalModeKeyBindings: defaultNormalModeKeyBindings,
            visualModeKeyBindings: defaultVisualModeKeyBindings,
        });
        let remapper = new remapper_1.Remappers();
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        yield modeHandler.handleKeyEvent('v');
        testUtils_1.assertEqual(modeHandler.currentMode.name, mode_1.ModeName.Visual);
        // act
        let actual = false;
        try {
            actual = yield remapper.sendKey([leaderKey, 'c'], modeHandler, modeHandler.vimState);
        }
        catch (e) {
            assert.fail(e);
        }
        // assert
        assert.equal(actual, true);
        assert.equal(vscode.window.visibleTextEditors.length, 0);
    }));
    test('d -> black hole register delete in normal mode through modehandler', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        yield setupWithBindings({
            insertModeKeyBindings: defaultInsertModeKeyBindings,
            normalModeKeyBindings: defaultNormalModeKeyBindings,
            visualModeKeyBindings: defaultVisualModeKeyBindings,
        });
        assert.equal(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g']);
        yield modeHandler.handleMultipleKeyEvents(['i', 'line1', '<Esc>', '0']);
        const expected = 'text-to-put-on-register';
        let actual;
        register_1.Register.put(expected, modeHandler.vimState);
        actual = yield register_1.Register.get(vimState);
        assert.equal(actual.text, expected);
        // act
        yield modeHandler.handleMultipleKeyEvents(['d', 'd']);
        // assert
        actual = yield register_1.Register.get(vimState);
        assert.equal(actual.text, expected);
    }));
    test('d -> black hole register delete in normal mode through modehandler', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        yield setupWithBindings({
            insertModeKeyBindings: defaultInsertModeKeyBindings,
            normalModeKeyBindings: defaultNormalModeKeyBindings,
            visualModeKeyBindings: defaultVisualModeKeyBindings,
        });
        assert.equal(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g']);
        yield modeHandler.handleMultipleKeyEvents(['i', 'word1 word2', '<Esc>', '0']);
        const expected = 'text-to-put-on-register';
        let actual;
        register_1.Register.put(expected, modeHandler.vimState);
        actual = yield register_1.Register.get(vimState);
        assert.equal(actual.text, expected);
        // act
        yield modeHandler.handleMultipleKeyEvents(['d', 'w']);
        // assert
        actual = yield register_1.Register.get(vimState);
        assert.equal(actual.text, expected);
    }));
    test('jj -> <Esc> after ciw operator through modehandler', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        yield setupWithBindings({
            insertModeKeyBindings: [
                {
                    before: ['j', 'j'],
                    after: ['<Esc>'],
                },
            ],
        });
        assert.equal(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g']);
        yield modeHandler.handleMultipleKeyEvents(['i', 'word1 word2', '<Esc>', '0']);
        assert.equal(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        // act
        yield modeHandler.handleMultipleKeyEvents(['c', 'i', 'w']);
        assert.equal(modeHandler.currentMode.name, mode_1.ModeName.Insert);
        yield modeHandler.handleMultipleKeyEvents(['j', 'j']);
        // assert
        assert.equal(modeHandler.currentMode.name, mode_1.ModeName.Normal);
    }));
});
/* tslint:enable:no-string-literal */

//# sourceMappingURL=remapper.test.js.map
