"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const notation_1 = require("../../src/configuration/notation");
suite('Notation', () => {
    test('Normalize', () => {
        const leaderKey = '//';
        const testCases = {
            '<cTrL+w>': '<C-w>',
            'cTrL+x': '<C-x>',
            'CtRl+y': '<C-y>',
            'c-z': '<C-z>',
            '<CmD+a>': '<D-a>',
            eScapE: '<Esc>',
            hOme: '<Home>',
            inSert: '<Insert>',
            eNd: '<End>',
            '<LeAder>': '//',
            LEaDer: '//',
            '<cR>': '\n',
            '<EnTeR>': '\n',
            '<space>': ' ',
            '<uP>': '<up>',
        };
        for (const test in testCases) {
            if (testCases.hasOwnProperty(test)) {
                let expected = testCases[test];
                let actual = notation_1.Notation.NormalizeKey(test, leaderKey);
                assert.equal(actual, expected);
            }
        }
    });
});

//# sourceMappingURL=notation.test.js.map
