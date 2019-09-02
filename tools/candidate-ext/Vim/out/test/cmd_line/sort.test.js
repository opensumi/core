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
const commandLine_1 = require("../../src/cmd_line/commandLine");
const testUtils_1 = require("./../testUtils");
suite('Basic sort', () => {
    let modeHandler;
    let vimState;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
        vimState = modeHandler.vimState;
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('Sort whole file, asc', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            'b',
            '<Esc>',
            'o',
            'a',
            '<Esc>',
            'o',
            'c',
            '<Esc>',
        ]);
        yield commandLine_1.commandLine.Run('sort', vimState);
        testUtils_1.assertEqualLines(['a', 'b', 'c']);
    }));
    test('Sort whole file, dsc', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            'b',
            '<Esc>',
            'o',
            'a',
            '<Esc>',
            'o',
            'c',
            '<Esc>',
        ]);
        yield commandLine_1.commandLine.Run('sort!', modeHandler.vimState);
        testUtils_1.assertEqualLines(['c', 'b', 'a']);
    }));
    test('Sort range, asc', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            'b',
            '<Esc>',
            'o',
            'd',
            '<Esc>',
            'o',
            'a',
            '<Esc>',
            'o',
            'c',
            '<Esc>',
        ]);
        yield commandLine_1.commandLine.Run('1,3sort', vimState);
        testUtils_1.assertEqualLines(['a', 'b', 'd', 'c']);
    }));
    test('Sort range, dsc', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            'b',
            '<Esc>',
            'o',
            'd',
            '<Esc>',
            'o',
            'a',
            '<Esc>',
            'o',
            'c',
            '<Esc>',
        ]);
        yield commandLine_1.commandLine.Run('2,4sort!', vimState);
        testUtils_1.assertEqualLines(['b', 'd', 'c', 'a']);
    }));
});

//# sourceMappingURL=sort.test.js.map
