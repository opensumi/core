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
suite('Repeatable movements with f and t', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
    }));
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: 'Can repeat f<character>',
        start: ['|abc abc abc'],
        keysPressed: 'fa;',
        end: ['abc abc |abc'],
    });
    newTest({
        title: 'Can repeat reversed F<character>',
        start: ['|abc abc abc'],
        keysPressed: 'fa$,',
        end: ['abc abc |abc'],
    });
    newTest({
        title: 'Can repeat t<character>',
        start: ['|abc abc abc'],
        keysPressed: 'tc;',
        end: ['abc a|bc abc'],
    });
    newTest({
        title: 'Can repeat N times reversed t<character>',
        start: ['|abc abc abc abc'],
        keysPressed: 'tc$3,',
        end: ['abc| abc abc abc'],
    });
});

//# sourceMappingURL=repeatableMovement.test.js.map
