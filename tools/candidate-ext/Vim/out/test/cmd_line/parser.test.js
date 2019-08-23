"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const parser = require("../../src/cmd_line/parser");
const token = require("../../src/cmd_line/token");
suite('command-line parser', () => {
    test('can parse empty string', () => {
        var cmd = parser.parse('');
        assert.ok(cmd.isEmpty);
    });
    test('can parse left - dot', () => {
        var cmd = parser.parse('.');
        assert.equal(cmd.range.left[0].type, token.TokenType.Dot);
    });
    test('can parse left - dollar', () => {
        var cmd = parser.parse('$');
        assert.equal(cmd.range.left[0].type, token.TokenType.Dollar);
    });
    test('can parse left - percent', () => {
        var cmd = parser.parse('%');
        assert.equal(cmd.range.left[0].type, token.TokenType.Percent);
    });
    test('can parse separator - comma', () => {
        var cmd = parser.parse(',');
        assert.equal(cmd.range.separator.type, token.TokenType.Comma);
    });
    test('can parse right - dollar', () => {
        var cmd = parser.parse(',$');
        assert.equal(cmd.range.left.length, 0);
        assert.equal(cmd.range.right.length, 1);
        assert.equal(cmd.range.right[0].type, token.TokenType.Dollar, 'unexpected token');
    });
});

//# sourceMappingURL=parser.test.js.map
