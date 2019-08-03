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
const testUtils_1 = require("./../testUtils");
suite('sneak plugin', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        globals_1.Globals.mockConfiguration.sneak = true;
        yield testUtils_1.reloadConfiguration();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: 'Can handle s motion',
        start: ['|abc abc'],
        keysPressed: 'sab',
        end: ['abc |abc'],
    });
    newTest({
        title: 'Can handle S motion',
        start: ['abc |abc'],
        keysPressed: 'Sab',
        end: ['|abc abc'],
    });
    newTest({
        title: 'Can handle <operator>z motion',
        start: ['|abc abc'],
        keysPressed: 'dzab',
        end: ['|abc'],
    });
    newTest({
        title: 'Can handle <operator>Z motion',
        start: ['abc |abc'],
        keysPressed: 'dZab',
        end: ['|abc'],
    });
    newTest({
        title: 'Can handle s; motion',
        start: ['|abc abc abc'],
        keysPressed: 'sab;',
        end: ['abc abc |abc'],
    });
    newTest({
        title: 'Can handle s, motion',
        start: ['abc abc| abc'],
        keysPressed: 'sab,',
        end: ['abc |abc abc'],
    });
    newTest({
        title: 'Can handle S; motion',
        start: ['abc abc |abc'],
        keysPressed: 'Sab;',
        end: ['|abc abc abc'],
    });
    newTest({
        title: 'Can handle S, motion',
        start: ['abc abc| abc'],
        keysPressed: 'Sab,',
        end: ['abc abc |abc'],
    });
});

//# sourceMappingURL=sneak.test.js.map
