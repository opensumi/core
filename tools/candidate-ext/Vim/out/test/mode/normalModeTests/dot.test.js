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
const testConfiguration_1 = require("../../testConfiguration");
const testSimplifier_1 = require("../../testSimplifier");
const testUtils_1 = require("./../../testUtils");
suite('Dot Operator', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        let configuration = new testConfiguration_1.Configuration();
        configuration.tabstop = 4;
        configuration.expandtab = false;
        yield testUtils_1.setupWorkspace(configuration);
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: "Can repeat '~' with <num>",
        start: ['|teXt'],
        keysPressed: '4~',
        end: ['TEx|T'],
    });
    newTest({
        title: "Can repeat '~' with dot",
        start: ['|teXt'],
        keysPressed: '~...',
        end: ['TEx|T'],
    });
    newTest({
        title: "Can repeat 'x'",
        start: ['|text'],
        keysPressed: 'x.',
        end: ['|xt'],
    });
    newTest({
        title: "Can repeat 'J'",
        start: ['|one', 'two', 'three'],
        keysPressed: 'J.',
        end: ['one two| three'],
    });
    newTest({
        title: 'Can handle dot with A',
        start: ['|one', 'two', 'three'],
        keysPressed: 'A!<Esc>j.j.',
        end: ['one!', 'two!', 'three|!'],
    });
    newTest({
        title: 'Can handle dot with I',
        start: ['on|e', 'two', 'three'],
        keysPressed: 'I!<Esc>j.j.',
        end: ['!one', '!two', '|!three'],
    });
    newTest({
        title: 'Can repeat actions that require selections',
        start: ['on|e', 'two'],
        keysPressed: 'Vj>.',
        end: ['\t\t|one', '\t\ttwo'],
    });
});
suite('Repeat content change', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    setup(() => __awaiter(this, void 0, void 0, function* () {
        let configuration = new testConfiguration_1.Configuration();
        configuration.tabstop = 4;
        configuration.expandtab = false;
        yield testUtils_1.setupWorkspace(configuration);
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: "Can repeat '<C-t>'",
        start: ['on|e', 'two'],
        keysPressed: 'a<C-t><Esc>j.',
        end: ['\tone', '\ttw|o'],
    });
    newTest({
        title: "Can repeat insert change and '<C-t>'",
        start: ['on|e', 'two'],
        keysPressed: 'a<C-t>b<Esc>j.',
        end: ['\toneb', '\ttwo|b'],
    });
    newTest({
        title: 'Can repeat change by `<C-a>`',
        start: ['on|e', 'two'],
        keysPressed: 'a<C-t>b<Esc>ja<C-a><Esc>',
        end: ['\toneb', '\ttwo|b'],
    });
    newTest({
        title: 'Only one arrow key can be repeated in Insert Mode',
        start: ['on|e', 'two'],
        keysPressed: 'a<left><left>b<Esc>j$.',
        end: ['obne', 'tw|bo'],
    });
    newTest({
        title: 'Cached content change will be cleared by arrow keys',
        start: ['on|e', 'two'],
        keysPressed: 'a<C-t>b<left>c<Esc>j.',
        end: ['\tonecb', 'tw|co'],
    });
});

//# sourceMappingURL=dot.test.js.map
