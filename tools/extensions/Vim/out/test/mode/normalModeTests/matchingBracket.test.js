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
const testSimplifier_1 = require("../../testSimplifier");
const testUtils_1 = require("./../../testUtils");
suite('Matching Bracket (%)', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: 'before opening parenthesis',
        start: ['|one (two)'],
        keysPressed: '%',
        end: ['one (two|)'],
    });
    newTest({
        title: 'inside parenthesis',
        start: ['(|one { two })'],
        keysPressed: '%',
        end: ['(one { two |})'],
    });
    newTest({
        title: 'nested parenthesis beginning',
        start: ['|((( )))'],
        keysPressed: '%',
        end: ['((( ))|)'],
    });
    newTest({
        title: 'nested parenthesis end',
        start: ['((( ))|)'],
        keysPressed: '%',
        end: ['|((( )))'],
    });
    newTest({
        title: 'nested bracket and parenthesis beginning',
        start: ['|[(( ))]'],
        keysPressed: '%',
        end: ['[(( ))|]'],
    });
    newTest({
        title: 'nested bracket, parenthesis, braces beginning',
        start: ['|[(( }}} ))]'],
        keysPressed: '%',
        end: ['[(( }}} ))|]'],
    });
    newTest({
        title: 'nested bracket, parenthesis, braces end',
        start: ['[(( }}} ))|]'],
        keysPressed: '%',
        end: ['|[(( }}} ))]'],
    });
    newTest({
        title: 'parentheses after >',
        start: ['|foo->bar(baz);'],
        keysPressed: '%',
        end: ['foo->bar(baz|);'],
    });
    newTest({
        title: 'parentheses after "',
        start: ['|test "in quotes" [(in brackets)]'],
        keysPressed: '%',
        end: ['test "in quotes" [(in brackets)|]'],
    });
});

//# sourceMappingURL=matchingBracket.test.js.map
