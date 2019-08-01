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
const lineCompletionProvider_1 = require("../../src/completion/lineCompletionProvider");
const position_1 = require("../../src/common/motion/position");
const testUtils_1 = require("../testUtils");
const util_1 = require("../../src/util/util");
suite('Provide line completions', () => {
    let modeHandler;
    let vimState;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
        vimState = modeHandler.vimState;
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    const setupTestWithLines = (lines) => __awaiter(this, void 0, void 0, function* () {
        vimState.cursorStopPosition = new position_1.Position(0, 0);
        yield modeHandler.handleKeyEvent('<Esc>');
        yield vimState.editor.edit(builder => {
            builder.insert(new position_1.Position(0, 0), lines.join('\n'));
        });
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g', 'j', 'j', 'A']);
        yield util_1.waitForCursorSync();
    });
    suite('Line Completion Provider unit tests', () => {
        test('Can complete lines in file, prioritizing above cursor, near cursor', () => __awaiter(this, void 0, void 0, function* () {
            const lines = ['a1', 'a2', 'a', 'a3', 'b1', 'a4'];
            yield setupTestWithLines(lines);
            const expectedCompletions = ['a2', 'a1', 'a3', 'a4'];
            const topCompletions = lineCompletionProvider_1.getCompletionsForCurrentLine(vimState.cursorStopPosition, vimState.editor.document).slice(0, expectedCompletions.length);
            assert.deepEqual(topCompletions, expectedCompletions, 'Unexpected completions found');
        }));
        test('Can complete lines in file with different indentation', () => __awaiter(this, void 0, void 0, function* () {
            const lines = ['a1', '   a 2', 'a', 'a3  ', 'b1', 'a4'];
            yield setupTestWithLines(lines);
            const expectedCompletions = ['a 2', 'a1', 'a3  ', 'a4'];
            const topCompletions = lineCompletionProvider_1.getCompletionsForCurrentLine(vimState.cursorStopPosition, vimState.editor.document).slice(0, expectedCompletions.length);
            assert.deepEqual(topCompletions, expectedCompletions, 'Unexpected completions found');
        }));
        test('Returns no completions for unmatched line', () => __awaiter(this, void 0, void 0, function* () {
            const lines = ['a1', '   a2', 'azzzzzzzzzzzzzzzzzzzzzzzz', 'a3  ', 'b1', 'a4'];
            yield setupTestWithLines(lines);
            const expectedCompletions = [];
            const completions = lineCompletionProvider_1.getCompletionsForCurrentLine(vimState.cursorStopPosition, vimState.editor.document).slice(0, expectedCompletions.length);
            assert.equal(completions.length, 0, 'Completions found, but none were expected');
        }));
    });
});

//# sourceMappingURL=lineCompletion.test.js.map
