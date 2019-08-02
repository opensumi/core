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
const vscode = require("vscode");
const extension_1 = require("../../extension");
const commandLine_1 = require("../../src/cmd_line/commandLine");
const testUtils_1 = require("./../testUtils");
suite('Basic write-quit', () => {
    let modeHandler;
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    test('Run write and quit', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>']);
        yield commandLine_1.commandLine.Run('wq', modeHandler.vimState);
        yield testUtils_1.WaitForEditorsToClose();
        testUtils_1.assertEqual(vscode.window.visibleTextEditors.length, 0, 'Window after 1sec still open');
    }));
});

//# sourceMappingURL=writequit.test.js.map
