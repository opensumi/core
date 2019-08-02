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
const testSimplifier_1 = require("./testSimplifier");
const testUtils_1 = require("./testUtils");
suite('sentence motion', () => {
    let { newTest } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace(undefined, '.js');
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    suite('[count] sentences backward', () => {
        newTest({
            title: 'move one sentence backward',
            start: ['lorem ipsum. lorem ipsum|'],
            keysPressed: '(',
            end: ['lorem ipsum. |lorem ipsum'],
        });
        newTest({
            title: 'move one sentence backward',
            start: ['lorem ipsum. lorem ipsum|'],
            keysPressed: '1(',
            end: ['lorem ipsum. |lorem ipsum'],
        });
        newTest({
            title: 'move [count] sentences backward',
            start: ['lorem ipsum. lorem ipsum. lorem ipsum|'],
            keysPressed: '2(',
            end: ['lorem ipsum. |lorem ipsum. lorem ipsum'],
        });
        newTest({
            title: 'move one sentence backward single line - middle',
            start: ['lorem ipsum. |lorem ipsum'],
            keysPressed: '(',
            end: ['|lorem ipsum. lorem ipsum'],
        });
        newTest({
            title: 'move one sentence backward no space',
            start: ['lorem ipsum.lorem ipsum|'],
            keysPressed: '(',
            end: ['|lorem ipsum.lorem ipsum'],
        });
        newTest({
            title: 'move one sentence backward no space - middle',
            start: ['lorem ipsum.|lorem ipsum'],
            keysPressed: '(',
            end: ['|lorem ipsum.lorem ipsum'],
        });
        newTest({
            title: 'move one sentence backward - multiline',
            start: ['lorem ipsum', 'lorem ipsum|'],
            keysPressed: '(',
            end: ['|lorem ipsum', 'lorem ipsum'],
        });
        newTest({
            title: 'move one sentence backward - multiline - period',
            start: ['lorem ipsum.', 'lorem ipsum|'],
            keysPressed: '(',
            end: ['lorem ipsum.', '|lorem ipsum'],
        });
        newTest({
            title: 'move one sentence backward - multiline - previous line',
            start: ['lorem ipsum', '|lorem ipsum'],
            keysPressed: '(',
            end: ['|lorem ipsum', 'lorem ipsum'],
        });
        newTest({
            title: 'move one sentence backward - multiline - previous line - period',
            start: ['lorem ipsum.', '|lorem ipsum'],
            keysPressed: '(',
            end: ['|lorem ipsum.', 'lorem ipsum'],
        });
    });
});

//# sourceMappingURL=sentenceMotion.test.js.map
