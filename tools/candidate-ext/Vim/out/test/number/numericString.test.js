"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const numericString_1 = require("../../src/common/number/numericString");
suite('numeric string', () => {
    test('fails on non-string', () => {
        assert.equal(null, numericString_1.NumericString.parse('hi'));
    });
    test('handles hex round trip', () => {
        const input = '0xa1';
        assert.equal(input, numericString_1.NumericString.parse(input).toString());
    });
    test('handles decimal round trip', () => {
        const input = '9';
        assert.equal(input, numericString_1.NumericString.parse(input).toString());
    });
    test('handles octal trip', () => {
        const input = '07';
        assert.equal(input, numericString_1.NumericString.parse(input).toString());
    });
});

//# sourceMappingURL=numericString.test.js.map
