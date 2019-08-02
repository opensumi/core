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
const testSimplifier_1 = require("../testSimplifier");
const testUtils_1 = require("./../testUtils");
suite('format operator', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace(undefined, '.ts');
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: '== formats current line',
        start: [' |let a;', '  let b;'],
        keysPressed: '==',
        end: ['|let a;', '  let b;'],
    });
    newTest({
        title: '=$ formats entire line',
        start: [' function f() {|let a;', 'let b;', '}'],
        keysPressed: '=$',
        end: ['|function f() {', '  let a;', 'let b;', '}'],
    });
    newTest({
        title: '=j formats two lines',
        start: [' |let a;', '  let b;', '  let c;'],
        keysPressed: '=j',
        end: ['|let a;', 'let b;', '  let c;'],
    });
    newTest({
        title: '3=k formats three lines',
        start: [' let a;', '  let b;', '|  let c;'],
        keysPressed: '3=k',
        end: ['|let a;', 'let b;', 'let c;'],
    });
    newTest({
        title: '=gg formats to top of file',
        start: [' let a;', '  let b;', '|  let c;'],
        keysPressed: '=gg',
        end: ['|let a;', 'let b;', 'let c;'],
    });
    newTest({
        title: '=G formats to bottom of file',
        start: ['|  let a;', '  let b;', '  let c;'],
        keysPressed: '=G',
        end: ['|let a;', 'let b;', 'let c;'],
    });
    newTest({
        title: '=ip formats paragraph',
        start: ['  function f() {', '|let a;', '  }', '', '  let b;'],
        keysPressed: '=ip',
        end: ['|function f() {', '  let a;', '}', '', '  let b;'],
    });
    newTest({
        title: 'format in visual mode',
        start: ['  function f() {', 'let a;', '|  }', '', '  let b;'],
        keysPressed: 'vkk=',
        end: ['|function f() {', '  let a;', '}', '', '  let b;'],
    });
});

//# sourceMappingURL=format.test.js.map
