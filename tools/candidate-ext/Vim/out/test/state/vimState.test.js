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
const position_1 = require("../../src/common/motion/position");
const range_1 = require("../../src/common/motion/range");
const vimState_1 = require("../../src/state/vimState");
const testUtils_1 = require("../testUtils");
suite('VimState', () => {
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('de-dupes cursors', () => {
        // setup
        const vimState = new vimState_1.VimState(vscode.window.activeTextEditor);
        const cursorStart = new position_1.Position(0, 0);
        const cursorStop = new position_1.Position(0, 1);
        const initialCursors = [new range_1.Range(cursorStart, cursorStop), new range_1.Range(cursorStart, cursorStop)];
        // test
        vimState.cursors = initialCursors;
        // assert
        assert.equal(vimState.cursors.length, 1);
    });
    test('cursorStart/cursorStop should be first cursor in cursors', () => {
        // setup
        const vimState = new vimState_1.VimState(vscode.window.activeTextEditor);
        const cursorStart = new position_1.Position(0, 0);
        const cursorStop = new position_1.Position(0, 1);
        const initialCursors = [
            new range_1.Range(cursorStart, cursorStop),
            new range_1.Range(new position_1.Position(1, 0), new position_1.Position(1, 1)),
        ];
        // test
        vimState.cursors = initialCursors;
        // assert
        assert.equal(vimState.cursors.length, 2);
        assert.equal(vimState.isMultiCursor, true);
        vimState.cursorStartPosition = cursorStart;
        vimState.cursorStopPosition = cursorStop;
    });
});

//# sourceMappingURL=vimState.test.js.map
