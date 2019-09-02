"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const lexer = require("../../src/cmd_line/lexer");
const token_1 = require("../../src/cmd_line/token");
suite('command-line lexer', () => {
    test('can lex empty string', () => {
        var tokens = lexer.lex('');
        assert.equal(tokens.length, 0);
    });
    test('can lex comma', () => {
        var tokens = lexer.lex(',');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.Comma, ',').content);
    });
    test('can lex percent', () => {
        var tokens = lexer.lex('%');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.Percent, '%').content);
    });
    test('can lex dollar', () => {
        var tokens = lexer.lex('$');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.Dollar, '$').content);
    });
    test('can lex dot', () => {
        var tokens = lexer.lex('.');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.Dot, '.').content);
    });
    test('can lex one number', () => {
        var tokens = lexer.lex('1');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.LineNumber, '1').content);
    });
    test('can lex longer number', () => {
        var tokens = lexer.lex('100');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.LineNumber, '100').content);
    });
    test('can lex plus', () => {
        var tokens = lexer.lex('+');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.Plus, '+').content);
    });
    test('can lex minus', () => {
        var tokens = lexer.lex('-');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.Minus, '-').content);
    });
    test('can lex forward search', () => {
        var tokens = lexer.lex('/horses/');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.ForwardSearch, 'horses').content);
    });
    test('can lex forward search escaping', () => {
        var tokens = lexer.lex('/hor\\/ses/');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.ForwardSearch, 'hor/ses').content);
    });
    test('can lex reverse search', () => {
        var tokens = lexer.lex('?worms?');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.ReverseSearch, 'worms').content);
    });
    test('can lex reverse search escaping', () => {
        var tokens = lexer.lex('?wor\\?ms?');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.ReverseSearch, 'wor?ms').content);
    });
    test('can lex command name', () => {
        var tokens = lexer.lex('w');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.CommandName, 'w').content);
    });
    test('can lex command args', () => {
        var tokens = lexer.lex('w something');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.CommandName, 'w').content);
        assert.equal(tokens[1].content, new token_1.Token(token_1.TokenType.CommandArgs, ' something').content);
    });
    test('can lex command args with leading whitespace', () => {
        var tokens = lexer.lex('q something');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.CommandName, 'q').content);
        assert.equal(tokens[1].content, new token_1.Token(token_1.TokenType.CommandArgs, ' something').content);
    });
    test('can lex long command name and args', () => {
        var tokens = lexer.lex('write12 something here');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.CommandName, 'write').content);
        assert.equal(tokens[1].content, new token_1.Token(token_1.TokenType.CommandArgs, '12 something here').content);
    });
    test('can lex left and right line refs', () => {
        var tokens = lexer.lex('20,30');
        assert.equal(tokens[0].content, new token_1.Token(token_1.TokenType.LineNumber, '20').content);
        assert.equal(tokens[1].content, new token_1.Token(token_1.TokenType.LineNumber, ',').content);
        assert.equal(tokens[2].content, new token_1.Token(token_1.TokenType.LineNumber, '30').content);
    });
});

//# sourceMappingURL=lexer.test.js.map
