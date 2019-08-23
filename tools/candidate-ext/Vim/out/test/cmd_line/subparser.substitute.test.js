"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const subparser_1 = require("../../src/cmd_line/subparser");
suite(':substitute args parser', () => {
    test('can parse pattern, replace, and flags', () => {
        var args = subparser_1.commandParsers.s('/a/b/g');
        assert.equal(args.arguments.pattern, 'a');
        assert.equal(args.arguments.replace, 'b');
        assert.equal(args.arguments.flags, 8);
    });
    test('can parse count', () => {
        var args = subparser_1.commandParsers.s('/a/b/g 3');
        assert.equal(args.arguments.count, 3);
    });
    test('can parse custom delimiter', () => {
        var args = subparser_1.commandParsers.s('#a#b#g');
        assert.equal(args.arguments.pattern, 'a');
        assert.equal(args.arguments.replace, 'b');
        assert.equal(args.arguments.flags, 8);
    });
    test('can escape delimiter', () => {
        var args = subparser_1.commandParsers.s('/\\/\\/a/b/');
        assert.equal(args.arguments.pattern, '//a');
        assert.equal(args.arguments.replace, 'b');
    });
    test('can parse flag KeepPreviousFlags', () => {
        var args = subparser_1.commandParsers.s('/a/b/&');
        assert.equal(args.arguments.flags, 1);
    });
});

//# sourceMappingURL=subparser.substitute.test.js.map
