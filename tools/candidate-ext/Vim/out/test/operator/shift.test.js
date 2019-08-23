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
suite('shift operator', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: 'basic shift left test',
        start: ['  |zxcv', '  zxcv', '  zxcv'],
        keysPressed: '<<',
        end: ['|zxcv', '  zxcv', '  zxcv'],
    });
    newTest({
        title: 'shift left goto end test',
        start: ['  |zxcv', '  zxcv', '  zxcv'],
        keysPressed: '<G',
        end: ['|zxcv', 'zxcv', 'zxcv'],
    });
    newTest({
        title: 'shift left goto line test',
        start: ['  |zxcv', '  zxcv', '  zxcv'],
        keysPressed: '<2G',
        end: ['|zxcv', 'zxcv', '  zxcv'],
    });
    newTest({
        title: 'shift right goto end test',
        start: ['|zxcv', 'zxcv', 'zxcv'],
        keysPressed: '>G',
        end: ['  |zxcv', '  zxcv', '  zxcv'],
    });
    newTest({
        title: 'shift right goto line test',
        start: ['|zxcv', 'zxcv', 'zxcv'],
        keysPressed: '>2G',
        end: ['  |zxcv', '  zxcv', 'zxcv'],
    });
});

//# sourceMappingURL=shift.test.js.map
