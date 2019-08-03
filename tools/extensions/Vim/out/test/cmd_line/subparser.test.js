"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const subparser_1 = require("../../src/cmd_line/subparser");
suite(':write args parser', () => {
    test('has all aliases', () => {
        assert.equal(subparser_1.commandParsers.write.name, subparser_1.commandParsers.w.name);
    });
    test('can parse empty args', () => {
        // TODO: perhaps we don't need to export this func at all.
        // TODO: this func must return args only, not a command?
        // TODO: the range must be passed separately, not as arg.
        var args = subparser_1.commandParsers.write('');
        assert.equal(args.arguments.append, undefined);
        assert.equal(args.arguments.bang, undefined);
        assert.equal(args.arguments.cmd, undefined);
        assert.equal(args.arguments.file, undefined);
        assert.equal(args.arguments.opt, undefined);
        assert.equal(args.arguments.optValue, undefined);
        assert.equal(args.arguments.range, undefined);
    });
    test('can parse ++opt', () => {
        var args = subparser_1.commandParsers.write('++enc=foo');
        assert.equal(args.arguments.append, undefined);
        assert.equal(args.arguments.bang, undefined);
        assert.equal(args.arguments.cmd, undefined);
        assert.equal(args.arguments.file, undefined);
        assert.equal(args.arguments.opt, 'enc');
        assert.equal(args.arguments.optValue, 'foo');
        assert.equal(args.arguments.range, undefined);
    });
    test('throws if bad ++opt name', () => {
        assert.throws(() => subparser_1.commandParsers.write('++foo=foo'));
    });
    test('can parse bang', () => {
        var args = subparser_1.commandParsers.write('!');
        assert.equal(args.arguments.append, undefined);
        assert.equal(args.arguments.bang, true);
        assert.equal(args.arguments.cmd, undefined);
        assert.equal(args.arguments.file, undefined);
        assert.equal(args.arguments.opt, undefined);
        assert.equal(args.arguments.optValue, undefined);
        assert.equal(args.arguments.range, undefined);
    });
    test("can parse ' !cmd'", () => {
        var args = subparser_1.commandParsers.write(' !foo');
        assert.equal(args.arguments.append, undefined);
        assert.equal(args.arguments.bang, undefined);
        assert.equal(args.arguments.cmd, 'foo');
        assert.equal(args.arguments.file, undefined);
        assert.equal(args.arguments.opt, undefined);
        assert.equal(args.arguments.optValue, undefined);
        assert.equal(args.arguments.range, undefined);
    });
    test("can parse ' !cmd' when cmd is empty", () => {
        var args = subparser_1.commandParsers.write(' !');
        assert.equal(args.arguments.append, undefined);
        assert.equal(args.arguments.bang, undefined);
        assert.equal(args.arguments.cmd, undefined);
        assert.equal(args.arguments.file, undefined);
        assert.equal(args.arguments.opt, undefined);
        assert.equal(args.arguments.optValue, undefined);
        assert.equal(args.arguments.range, undefined);
    });
});

//# sourceMappingURL=subparser.test.js.map
