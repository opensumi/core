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
const testUtils_1 = require("./../testUtils");
suite('Mode Handler', () => {
    let modeHandler;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('ctor', () => {
        assert.equal(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        assert.equal(modeHandler.currentMode.isActive, true);
    });
    test('can set current mode', () => __awaiter(this, void 0, void 0, function* () {
        assert.equal(modeHandler.currentMode.name, mode_1.ModeName.Normal);
        yield modeHandler.handleKeyEvent('i');
        assert.equal(modeHandler.currentMode.name, mode_1.ModeName.Insert);
    }));
});

//# sourceMappingURL=modeHandler.test.js.map
