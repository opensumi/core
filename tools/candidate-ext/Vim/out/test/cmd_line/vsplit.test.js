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
suite('Vertical split', () => {
    let modeHandler;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('Run :vs', () => __awaiter(this, void 0, void 0, function* () {
        yield commandLine_1.commandLine.Run('vs', modeHandler.vimState);
        yield testUtils_1.WaitForEditorsToClose(2);
        testUtils_1.assertEqual(vscode.window.visibleTextEditors.length, 2, 'Editor did not split in 1 sec');
    }));
    test('Run :vsp', () => __awaiter(this, void 0, void 0, function* () {
        yield commandLine_1.commandLine.Run('vsp', modeHandler.vimState);
        yield testUtils_1.WaitForEditorsToClose(2);
        testUtils_1.assertEqual(vscode.window.visibleTextEditors.length, 2, 'Editor did not split in 1 sec');
    }));
    test('Run :vsplit', () => __awaiter(this, void 0, void 0, function* () {
        yield commandLine_1.commandLine.Run('vsplit', modeHandler.vimState);
        yield testUtils_1.WaitForEditorsToClose(2);
        testUtils_1.assertEqual(vscode.window.visibleTextEditors.length, 2, 'Editor did not split in 1 sec');
    }));
    test('Run :vnew', () => __awaiter(this, void 0, void 0, function* () {
        yield commandLine_1.commandLine.Run('vnew', modeHandler.vimState);
        yield testUtils_1.WaitForEditorsToClose(2);
        testUtils_1.assertEqual(vscode.window.visibleTextEditors.length, 2, 'Editor did not split in 1 sec');
    }));
    test('Run :vne', () => __awaiter(this, void 0, void 0, function* () {
        yield commandLine_1.commandLine.Run('vne', modeHandler.vimState);
        yield testUtils_1.WaitForEditorsToClose(2);
        testUtils_1.assertEqual(vscode.window.visibleTextEditors.length, 2, 'Editor did not split in 1 sec');
    }));
});

//# sourceMappingURL=vsplit.test.js.map
