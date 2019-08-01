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
const extension_1 = require("../extension");
const position_1 = require("../src/common/motion/position");
const globals_1 = require("../src/globals");
const mode_1 = require("../src/mode/mode");
const textEditor_1 = require("../src/textEditor");
const util_1 = require("../src/util/util");
const testUtils_1 = require("./testUtils");
function getTestingFunctions() {
    const getNiceStack = (stack) => {
        return stack
            ? stack
                .split('\n')
                .splice(2, 1)
                .join('\n')
            : 'no stack available :(';
    };
    const newTest = (testObj) => {
        const stack = new Error().stack;
        let niceStack = getNiceStack(stack);
        test(testObj.title, () => __awaiter(this, void 0, void 0, function* () {
            return testIt
                .bind(null, yield extension_1.getAndUpdateModeHandler())(testObj)
                .catch((reason) => {
                reason.stack = niceStack;
                throw reason;
            });
        }));
    };
    const newTestOnly = (testObj) => {
        console.log('!!! Running single test !!!');
        const stack = new Error().stack;
        let niceStack = getNiceStack(stack);
        test.only(testObj.title, () => __awaiter(this, void 0, void 0, function* () {
            return testIt
                .bind(null, yield extension_1.getAndUpdateModeHandler())(testObj)
                .catch((reason) => {
                reason.stack = niceStack;
                throw reason;
            });
        }));
    };
    return {
        newTest,
        newTestOnly,
    };
}
exports.getTestingFunctions = getTestingFunctions;
class TestObjectHelper {
    constructor(_testObject) {
        /**
         * Position that the test says that the cursor starts at.
         */
        this.startPosition = new position_1.Position(0, 0);
        /**
         * Position that the test says that the cursor ends at.
         */
        this.endPosition = new position_1.Position(0, 0);
        this._isValid = false;
        this._testObject = _testObject;
        this._parse(_testObject);
    }
    get isValid() {
        return this._isValid;
    }
    _setStartCursorPosition(lines) {
        let result = this._getCursorPosition(lines);
        this.startPosition = result.position;
        return result.success;
    }
    _setEndCursorPosition(lines) {
        let result = this._getCursorPosition(lines);
        this.endPosition = result.position;
        return result.success;
    }
    _getCursorPosition(lines) {
        let ret = { success: false, position: new position_1.Position(0, 0) };
        for (let i = 0; i < lines.length; i++) {
            let columnIdx = lines[i].indexOf('|');
            if (columnIdx >= 0) {
                ret.position = ret.position.withLine(i).withColumn(columnIdx);
                ret.success = true;
            }
        }
        return ret;
    }
    _parse(t) {
        this._isValid = true;
        if (!this._setStartCursorPosition(t.start)) {
            this._isValid = false;
        }
        if (!this._setEndCursorPosition(t.end)) {
            this._isValid = false;
        }
    }
    asVimInputText() {
        let ret = 'i' + this._testObject.start.join('\n').replace('|', '');
        return ret.split('');
    }
    asVimOutputText() {
        let ret = this._testObject.end.slice(0);
        ret[this.endPosition.line] = ret[this.endPosition.line].replace('|', '');
        return ret;
    }
    /**
     * Returns a sequence of Vim movement characters 'hjkl' as a string array
     * which will move the cursor to the start position given in the test.
     */
    getKeyPressesToMoveToStartPosition() {
        let ret = '';
        let linesToMove = this.startPosition.line;
        let cursorPosAfterEsc = this._testObject.start[this._testObject.start.length - 1].replace('|', '').length - 1;
        let numCharsInCursorStartLine = this._testObject.start[this.startPosition.line].replace('|', '').length - 1;
        let charactersToMove = this.startPosition.character;
        if (linesToMove > 0) {
            ret += Array(linesToMove + 1).join('j');
        }
        else if (linesToMove < 0) {
            ret += Array(Math.abs(linesToMove) + 1).join('k');
        }
        if (charactersToMove > 0) {
            ret += Array(charactersToMove + 1).join('l');
        }
        else if (charactersToMove < 0) {
            ret += Array(Math.abs(charactersToMove) + 1).join('h');
        }
        return ret.split('');
    }
}
/**
 * Tokenize a string like "abc<Esc>d<C-c>" into ["a", "b", "c", "<Esc>", "d", "<C-c>"]
 */
function tokenizeKeySequence(sequence) {
    let isBracketedKey = false;
    let key = '';
    let result = [];
    // no close bracket, probably trying to do a left shift, take literal
    // char sequence
    function rawTokenize(characters) {
        for (const char of characters) {
            result.push(char);
        }
    }
    for (const char of sequence) {
        key += char;
        if (char === '<') {
            if (isBracketedKey) {
                rawTokenize(key.slice(0, key.length - 1));
                key = '<';
            }
            else {
                isBracketedKey = true;
            }
        }
        if (char === '>') {
            isBracketedKey = false;
        }
        if (isBracketedKey) {
            continue;
        }
        result.push(key);
        key = '';
    }
    if (isBracketedKey) {
        rawTokenize(key);
    }
    return result;
}
function testIt(modeHandler, testObj) {
    return __awaiter(this, void 0, void 0, function* () {
        modeHandler.vimState.editor = vscode.window.activeTextEditor;
        let helper = new TestObjectHelper(testObj);
        const jumpTracker = modeHandler.vimState.globalState.jumpTracker;
        // Don't try this at home, kids.
        modeHandler.vimState.cursorPosition = new position_1.Position(0, 0);
        yield modeHandler.handleKeyEvent('<Esc>');
        // Insert all the text as a single action.
        yield modeHandler.vimState.editor.edit(builder => {
            builder.insert(new position_1.Position(0, 0), testObj.start.join('\n').replace('|', ''));
        });
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g']);
        yield util_1.waitForCursorSync();
        // Since we bypassed VSCodeVim to add text,
        // we need to tell the history tracker that we added it.
        modeHandler.vimState.historyTracker.addChange();
        modeHandler.vimState.historyTracker.finishCurrentStep();
        // move cursor to start position using 'hjkl'
        yield modeHandler.handleMultipleKeyEvents(helper.getKeyPressesToMoveToStartPosition());
        yield util_1.waitForCursorSync();
        globals_1.Globals.mockModeHandler = modeHandler;
        let keysPressed = testObj.keysPressed;
        if (process.platform === 'win32') {
            keysPressed = keysPressed.replace(/\\n/g, '\\r\\n');
        }
        jumpTracker.clearJumps();
        // assumes key presses are single characters for nowkA
        yield modeHandler.handleMultipleKeyEvents(tokenizeKeySequence(keysPressed));
        // Check valid test object input
        assert(helper.isValid, "Missing '|' in test object.");
        // end: check given end output is correct
        //
        const lines = helper.asVimOutputText();
        testUtils_1.assertEqualLines(lines);
        // Check final cursor position
        //
        let actualPosition = position_1.Position.FromVSCodePosition(textEditor_1.TextEditor.getSelection().start);
        let expectedPosition = helper.endPosition;
        assert.equal(actualPosition.line, expectedPosition.line, 'Cursor LINE position is wrong.');
        assert.equal(actualPosition.character, expectedPosition.character, 'Cursor CHARACTER position is wrong.');
        // endMode: check end mode is correct if given
        if (typeof testObj.endMode !== 'undefined') {
            let actualMode = mode_1.ModeName[modeHandler.currentMode.name].toUpperCase();
            let expectedMode = mode_1.ModeName[testObj.endMode].toUpperCase();
            assert.equal(actualMode, expectedMode, "Didn't enter correct mode.");
        }
        // jumps: check jumps are correct if given
        if (typeof testObj.jumps !== 'undefined') {
            assert.deepEqual(jumpTracker.jumps.map(j => lines[j.position.line] || '<MISSING>'), testObj.jumps.map(t => t.replace('|', '')), 'Incorrect jumps found');
            const stripBar = text => (text ? text.replace('|', '') : text);
            const actualJumpPosition = (jumpTracker.currentJump && lines[jumpTracker.currentJump.position.line]) || '<FRONT>';
            const expectedJumpPosition = stripBar(testObj.jumps.find(t => t.includes('|'))) || '<FRONT>';
            assert.deepEqual(actualJumpPosition.toString(), expectedJumpPosition.toString(), 'Incorrect jump position found');
        }
    });
}
exports.testIt = testIt;

//# sourceMappingURL=testSimplifier.js.map
