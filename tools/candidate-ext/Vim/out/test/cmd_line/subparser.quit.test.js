"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const subparser_1 = require("../../src/cmd_line/subparser");
suite(':quit args parser', () => {
    test('has all aliases', () => {
        assert.equal(subparser_1.commandParsers.quit.name, subparser_1.commandParsers.q.name);
    });
    test('can parse empty args', () => {
        var args = subparser_1.commandParsers.quit('');
        assert.equal(args.arguments.bang, undefined);
        assert.equal(args.arguments.range, undefined);
    });
    test('ignores trailing white space', () => {
        var args = subparser_1.commandParsers.quit('  ');
        assert.equal(args.arguments.bang, undefined);
        assert.equal(args.arguments.range, undefined);
    });
    test('can parse !', () => {
        var args = subparser_1.commandParsers.quit('!');
        assert.ok(args.arguments.bang);
        assert.equal(args.arguments.range, undefined);
    });
    test('throws if space before !', () => {
        assert.throws(() => subparser_1.commandParsers.quit(' !'));
    });
    test('ignores space after !', () => {
        var args = subparser_1.commandParsers.quit('! ');
        assert.equal(args.arguments.bang, true);
        assert.equal(args.arguments.range, undefined);
    });
    test('throws if bad input', () => {
        assert.throws(() => subparser_1.commandParsers.quit('x'));
    });
});

//# sourceMappingURL=subparser.quit.test.js.map
