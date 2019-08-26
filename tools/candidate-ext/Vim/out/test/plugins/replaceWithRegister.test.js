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
const globals_1 = require("../../src/globals");
const testSimplifier_1 = require("../testSimplifier");
const testUtils_1 = require("../testUtils");
suite('replaceWithRegister plugin', () => {
    const { newTest } = testSimplifier_1.getTestingFunctions();
    const YankInnerWord = 'yiw';
    const ReplaceOperator = 'gr';
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        globals_1.Globals.mockConfiguration.replaceWithRegister = true;
        yield testUtils_1.reloadConfiguration();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: 'Replaces within inner word',
        start: ['|first second'],
        keysPressed: `${YankInnerWord}w${ReplaceOperator}iw`,
        end: ['first firs|t'],
    });
    newTest({
        title: 'Replaces within inner Word',
        start: ['|first sec-ond'],
        keysPressed: `${YankInnerWord}w${ReplaceOperator}iW`,
        end: ['first firs|t'],
    });
    newTest({
        title: "Replaces within ''",
        start: ["|first 'second'"],
        keysPressed: `${YankInnerWord}ww${ReplaceOperator}i'`,
        end: ["first 'firs|t'"],
    });
    newTest({
        title: "Replaces within '' including spaces",
        start: ["|first ' second '"],
        keysPressed: `${YankInnerWord}ww${ReplaceOperator}i'`,
        end: ["first 'firs|t'"],
    });
    newTest({
        title: 'Replaces within ()',
        start: ['|first (second)'],
        keysPressed: `${YankInnerWord}ww${ReplaceOperator}i)`,
        end: ['first (firs|t)'],
    });
    newTest({
        title: 'Replaces within () including spaces',
        start: ['|first ( second )'],
        keysPressed: `${YankInnerWord}ww${ReplaceOperator}i)`,
        end: ['first (firs|t)'],
    });
    newTest({
        title: 'Replaces within a paragraph',
        start: ['  |first', '  second'],
        keysPressed: `${YankInnerWord}${ReplaceOperator}ap`,
        end: ['|first'],
    });
    newTest({
        title: 'Replaces using a specified register',
        start: ['|first second'],
        keysPressed: `"a${YankInnerWord}w"a${ReplaceOperator}iw`,
        end: ['first firs|t'],
    });
    newTest({
        title: 'Replaces within {} over multiple lines',
        start: ['{', '  first', '  s|econd', '  third', '}'],
        keysPressed: `${YankInnerWord}${ReplaceOperator}i}`,
        end: ['{', '|second', '}'],
    });
    newTest({
        title: 'Replaces a multiline register within {} over multiple lines',
        start: ['{', '  first', '  s|econd', '  third', '}'],
        keysPressed: `yj${ReplaceOperator}i}`,
        end: ['{', '  |second', '  third', '}'],
    });
    newTest({
        title: 'Replaces a multiline register within {} over multiple lines',
        start: ['{', '  first', '  s|econd', '  third', '}'],
        keysPressed: `yj${ReplaceOperator}i}`,
        end: ['{', '  |second', '  third', '}'],
    });
    newTest({
        title: 'Yanking inside {} then replacing inside {} in a noop, besides the cursor movement',
        start: ['{', '  first', '  s|econd', '  third', '}'],
        keysPressed: `yi}${ReplaceOperator}i}`,
        end: ['{', '  |first', '  second', '  third', '}'],
    });
    newTest({
        title: 'grr replaces the entire line with the register',
        start: ['first sec|ond third'],
        keysPressed: `${YankInnerWord}grr`,
        end: ['|second'],
    });
    newTest({
        title: 'grr can replace multiple lines',
        start: ['|first', 'second', 'third'],
        keysPressed: `${YankInnerWord}2grr`,
        end: ['|first', 'third'],
    });
});

//# sourceMappingURL=replaceWithRegister.test.js.map
