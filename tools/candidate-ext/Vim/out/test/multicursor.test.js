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
const extension_1 = require("../extension");
const testUtils_1 = require("./testUtils");
suite('Multicursor', () => {
    let modeHandler;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('can add multiple cursors below', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('i11\n22'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', 'g', 'g']);
        testUtils_1.assertEqualLines(['11', '22']);
        if (process.platform === 'darwin') {
            yield modeHandler.handleMultipleKeyEvents(['<D-alt+down>']);
        }
        else {
            yield modeHandler.handleMultipleKeyEvents(['<C-alt+down>']);
        }
        testUtils_1.assertEqual(modeHandler.vimState.cursors.length, 2, 'Cursor succesfully created.');
        yield modeHandler.handleMultipleKeyEvents(['c', 'w', '3', '3', '<Esc>']);
        testUtils_1.assertEqualLines(['33', '33']);
    }));
    test('can add multiple cursors above', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents('i11\n22\n33'.split(''));
        yield modeHandler.handleMultipleKeyEvents(['<Esc>', '0']);
        testUtils_1.assertEqualLines(['11', '22', '33']);
        if (process.platform === 'darwin') {
            yield modeHandler.handleMultipleKeyEvents(['<D-alt+up>', '<D-alt+up>']);
        }
        else {
            yield modeHandler.handleMultipleKeyEvents(['<C-alt+up>', '<C-alt+up>']);
        }
        testUtils_1.assertEqual(modeHandler.vimState.cursors.length, 3, 'Cursor succesfully created.');
        yield modeHandler.handleMultipleKeyEvents(['c', 'w', '4', '4', '<Esc>']);
        testUtils_1.assertEqualLines(['44', '44', '44']);
    }));
});

//# sourceMappingURL=multicursor.test.js.map
