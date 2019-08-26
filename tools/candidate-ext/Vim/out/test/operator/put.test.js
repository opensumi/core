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
const testUtils_1 = require("../testUtils");
suite('put operator', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: 'basic put test',
        start: ['blah bla|h'],
        keysPressed: '^Dpp',
        end: ['blah blahblah bla|h'],
    });
    newTest({
        title: 'test yy end of line',
        start: ['blah blah', 'bla|h'],
        keysPressed: '^yyp',
        end: ['blah blah', 'blah', '|blah'],
    });
    newTest({
        title: 'test yy first line',
        start: ['blah blah', 'bla|h'],
        keysPressed: 'ggyyp',
        end: ['blah blah', '|blah blah', 'blah'],
    });
    newTest({
        title: 'test yy middle line',
        start: ['1', '2', '|3'],
        keysPressed: 'kyyp',
        end: ['1', '2', '|2', '3'],
    });
    newTest({
        title: 'test yy with correct positon movement',
        start: ['o|ne', 'two', 'three', 'four'],
        keysPressed: '2yyjjpk',
        end: ['one', 'two', '|three', 'one', 'two', 'four'],
    });
    newTest({
        title: 'test visual block single line yank p',
        start: ['12|345'],
        keysPressed: '<C-v>llyhp',
        end: ['12|345345'],
    });
    newTest({
        title: 'test visual block single line yank P',
        start: ['12|345'],
        keysPressed: '<C-v>llyhP',
        end: ['1|3452345'],
    });
    newTest({
        title: 'test visual block single line delete p',
        start: ['12|345'],
        keysPressed: '<C-v>lldhp',
        end: ['1|3452'],
    });
    newTest({
        title: 'test visual block single line delete P',
        start: ['12|345'],
        keysPressed: '<C-v>lldhP',
        end: ['|34512'],
    });
});

//# sourceMappingURL=put.test.js.map
