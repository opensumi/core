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
const testConfiguration_1 = require("../testConfiguration");
const testUtils_1 = require("../testUtils");
const imswitcher_1 = require("../../src/actions/plugins/imswitcher");
const mode_1 = require("../../src/mode/mode");
suite('Input method plugin', () => {
    let savedCmd = '';
    function fakeExecuteChinese(cmd) {
        return new Promise((resolve, reject) => {
            if (cmd === 'im-select') {
                resolve('chinese');
            }
            else {
                savedCmd = cmd;
                resolve('');
            }
        });
    }
    function fakeExecuteDefault(cmd) {
        return new Promise((resolve, reject) => {
            if (cmd === 'im-select') {
                resolve('default');
            }
            else {
                savedCmd = cmd;
                resolve('');
            }
        });
    }
    setup(() => __awaiter(this, void 0, void 0, function* () {
        let configuration = new testConfiguration_1.Configuration();
        configuration.autoSwitchInputMethod.enable = true;
        configuration.autoSwitchInputMethod.defaultIM = 'default';
        configuration.autoSwitchInputMethod.obtainIMCmd = 'im-select';
        configuration.autoSwitchInputMethod.switchIMCmd = 'im-select {im}';
        yield testUtils_1.setupWorkspace(configuration);
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('use default im in insert mode', () => __awaiter(this, void 0, void 0, function* () {
        savedCmd = '';
        const inputMethodSwitcher = new imswitcher_1.InputMethodSwitcher(fakeExecuteDefault);
        yield inputMethodSwitcher.switchInputMethod(mode_1.ModeName.Normal, mode_1.ModeName.Insert);
        assert.equal('', savedCmd);
        yield inputMethodSwitcher.switchInputMethod(mode_1.ModeName.Insert, mode_1.ModeName.Normal);
        assert.equal('', savedCmd);
        yield inputMethodSwitcher.switchInputMethod(mode_1.ModeName.Normal, mode_1.ModeName.Insert);
        assert.equal('', savedCmd);
        yield inputMethodSwitcher.switchInputMethod(mode_1.ModeName.Insert, mode_1.ModeName.Normal);
        assert.equal('', savedCmd);
    }));
    test('use other im in insert mode', () => __awaiter(this, void 0, void 0, function* () {
        savedCmd = '';
        const inputMethodSwitcher = new imswitcher_1.InputMethodSwitcher(fakeExecuteChinese);
        yield inputMethodSwitcher.switchInputMethod(mode_1.ModeName.Normal, mode_1.ModeName.Insert);
        assert.equal('', savedCmd);
        yield inputMethodSwitcher.switchInputMethod(mode_1.ModeName.Insert, mode_1.ModeName.Normal);
        assert.equal('im-select default', savedCmd);
        yield inputMethodSwitcher.switchInputMethod(mode_1.ModeName.Normal, mode_1.ModeName.Insert);
        assert.equal('im-select chinese', savedCmd);
        yield inputMethodSwitcher.switchInputMethod(mode_1.ModeName.Insert, mode_1.ModeName.Normal);
        assert.equal('im-select default', savedCmd);
    }));
});

//# sourceMappingURL=imswitcher.test.js.map
