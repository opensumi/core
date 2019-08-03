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
const testConfiguration_1 = require("./testConfiguration");
const testSimplifier_1 = require("./testSimplifier");
const testUtils_1 = require("./testUtils");
suite('motion line wrapping', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    teardown(testUtils_1.cleanUpWorkspace);
    suite('whichwrap enabled', () => {
        setup(() => __awaiter(this, void 0, void 0, function* () {
            let configuration = new testConfiguration_1.Configuration();
            configuration.tabstop = 4;
            configuration.expandtab = false;
            configuration.whichwrap = 'h,l,<,>,[,]';
            yield testUtils_1.setupWorkspace(configuration);
        }));
        suite('normal mode', () => {
            newTest({
                title: 'h wraps to previous line',
                start: ['line 1', '|line 2'],
                keysPressed: 'h',
                end: ['line |1', 'line 2'],
            });
            newTest({
                title: 'l wraps to next line',
                start: ['line |1', 'line 2'],
                keysPressed: 'l',
                end: ['line 1', '|line 2'],
            });
            newTest({
                title: '<left> wraps to previous line',
                start: ['line 1', '|line 2'],
                keysPressed: '<left>',
                end: ['line |1', 'line 2'],
            });
            newTest({
                title: '<right> wraps to next line',
                start: ['line |1', 'line 2'],
                keysPressed: '<right>',
                end: ['line 1', '|line 2'],
            });
        });
        suite('insert mode', () => {
            newTest({
                title: '<left> wraps to previous line',
                start: ['line 1', '|line 2'],
                // insert mode moves cursor one space to the left,
                // but not at beginning of line
                keysPressed: 'i<left>',
                end: ['line 1|', 'line 2'],
            });
            newTest({
                title: '<right> once goes to end of line',
                start: ['line |1', 'line 2'],
                // insert mode moves cursor one space to the left
                // so <right> once should go to eol
                keysPressed: 'i<right>',
                end: ['line 1|', 'line 2'],
            });
            newTest({
                title: '<right> twice wraps to next line',
                start: ['line |1', 'line 2'],
                // insert mode moves cursor one space to the left
                // so need to go right twice to wrap
                keysPressed: 'i<right><right>',
                end: ['line 1', '|line 2'],
            });
        });
    });
    suite('whichwrap disabled', () => {
        setup(() => __awaiter(this, void 0, void 0, function* () {
            let configuration = new testConfiguration_1.Configuration();
            configuration.tabstop = 4;
            configuration.expandtab = false;
            yield testUtils_1.setupWorkspace(configuration);
        }));
        suite('normal mode', () => {
            newTest({
                title: 'h does not wrap to previous line',
                start: ['line 1', '|line 2'],
                keysPressed: 'h',
                end: ['line 1', '|line 2'],
            });
            newTest({
                title: 'l does not wrap to next line',
                start: ['line |1', 'line 2'],
                keysPressed: 'l',
                end: ['line |1', 'line 2'],
            });
            newTest({
                title: '<left> does not wrap to previous line',
                start: ['line 1', '|line 2'],
                keysPressed: '<left>',
                end: ['line 1', '|line 2'],
            });
            newTest({
                title: '<right> does not wrap to next line',
                start: ['line |1', 'line 2'],
                keysPressed: '<right>',
                end: ['line |1', 'line 2'],
            });
        });
        suite('insert mode', () => {
            newTest({
                title: '<left> does not wrap to previous line',
                start: ['line 1', '|line 2'],
                keysPressed: 'i<left>',
                end: ['line 1', '|line 2'],
            });
            newTest({
                title: '<right> does not wrap to next line',
                start: ['line |1', 'line 2'],
                keysPressed: 'i<right><right>',
                end: ['line 1|', 'line 2'],
            });
        });
    });
});

//# sourceMappingURL=motionLineWrapping.test.js.map
