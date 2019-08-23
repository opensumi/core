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
const mode_1 = require("../../src/mode/mode");
const testSimplifier_1 = require("../testSimplifier");
const testUtils_1 = require("./../testUtils");
suite('comment operator', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace(undefined, '.js');
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: 'gcc comments out current line',
        start: ['first line', '|second line'],
        keysPressed: 'gcc',
        end: ['first line', '|// second line'],
    });
    newTest({
        title: 'gcj comments in current and next line',
        start: ['// first| line', '// second line', 'third line'],
        keysPressed: 'gcj',
        end: ['|first line', 'second line', 'third line'],
    });
    newTest({
        title: 'block comment with motion',
        start: ['function test(arg|1, arg2, arg3) {'],
        keysPressed: 'gCi)',
        end: ['function test(|/* arg1, arg2, arg3 */) {'],
    });
    newTest({
        title: 'block comment in Visual Mode',
        start: ['blah |blah blah'],
        keysPressed: 'vllllgC',
        end: ['blah |/* blah */ blah'],
        endMode: mode_1.ModeName.Normal,
    });
});

//# sourceMappingURL=comment.test.js.map
