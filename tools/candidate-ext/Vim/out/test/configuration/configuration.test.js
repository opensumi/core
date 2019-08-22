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
const assert = require("assert");
const srcConfiguration = require("../../src/configuration/configuration");
const testConfiguration = require("../testConfiguration");
const testUtils_1 = require("./../testUtils");
const testSimplifier_1 = require("../testSimplifier");
const mode_1 = require("../../src/mode/mode");
suite('Configuration', () => {
    const { newTest } = testSimplifier_1.getTestingFunctions();
    let configuration = new testConfiguration.Configuration();
    configuration.leader = '<space>';
    configuration.normalModeKeyBindingsNonRecursive = [
        {
            before: ['leader', 'o'],
            after: ['o', 'eSc', 'k'],
        },
        {
            before: ['<leader>', 'f', 'e', 's'],
            after: ['v'],
        },
    ];
    configuration.whichwrap = 'h,l';
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace(configuration);
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    test('remappings are normalized', () => __awaiter(this, void 0, void 0, function* () {
        const normalizedKeybinds = srcConfiguration.configuration.normalModeKeyBindingsNonRecursive;
        const normalizedKeybindsMap = srcConfiguration.configuration.normalModeKeyBindingsNonRecursiveMap;
        const testingKeybinds = configuration.normalModeKeyBindingsNonRecursive;
        assert.equal(normalizedKeybinds.length, testingKeybinds.length);
        assert.equal(normalizedKeybinds.length, normalizedKeybindsMap.size);
        assert.deepEqual(normalizedKeybinds[0].before, [' ', 'o']);
        assert.deepEqual(normalizedKeybinds[0].after, ['o', '<Esc>', 'k']);
    }));
    test('whichwrap is parsed into wrapKeys', () => __awaiter(this, void 0, void 0, function* () {
        let wrapKeys = srcConfiguration.configuration.wrapKeys;
        const h = 'h';
        const j = 'j';
        assert.equal(wrapKeys[h], true);
        assert.equal(wrapKeys[j], undefined);
    }));
    newTest({
        title: 'Can handle long key chords',
        start: ['|'],
        // <leader>fes
        keysPressed: ' fes',
        end: ['|'],
        endMode: mode_1.ModeName.Visual,
    });
});

//# sourceMappingURL=configuration.test.js.map
