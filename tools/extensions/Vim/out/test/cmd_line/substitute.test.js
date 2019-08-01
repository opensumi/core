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
const sinon = require("sinon");
const substitute_1 = require("../../src/cmd_line/commands/substitute");
const extension_1 = require("../../extension");
const commandLine_1 = require("../../src/cmd_line/commandLine");
const globals_1 = require("../../src/globals");
const testUtils_1 = require("./../testUtils");
const testSimplifier_1 = require("../testSimplifier");
suite('Basic substitute', () => {
    let { newTest, newTestOnly } = testSimplifier_1.getTestingFunctions();
    let modeHandler;
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        modeHandler = yield extension_1.getAndUpdateModeHandler();
    }));
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    test('Replace single word once', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>']);
        yield commandLine_1.commandLine.Run('%s/a/d', modeHandler.vimState);
        testUtils_1.assertEqualLines(['dba']);
    }));
    test('Replace with `g` flag', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>']);
        yield commandLine_1.commandLine.Run('%s/a/d/g', modeHandler.vimState);
        testUtils_1.assertEqualLines(['dbd']);
    }));
    newTest({
        title: 'Replace with flags AND count',
        start: ['|blah blah', 'blah', 'blah blah', 'blah blah'],
        keysPressed: ':.s/blah/yay/g 2\n',
        end: ['|yay yay', 'yay', 'blah blah', 'blah blah'],
    });
    test('Replace with `c` flag', () => __awaiter(this, void 0, void 0, function* () {
        const confirmStub = sinon
            .stub(substitute_1.SubstituteCommand.prototype, 'confirmReplacement')
            .resolves(true);
        yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>']);
        yield commandLine_1.commandLine.Run('%s/a/d/c', modeHandler.vimState);
        testUtils_1.assertEqualLines(['dba']);
        confirmStub.restore();
    }));
    test('Replace with `gc` flag', () => __awaiter(this, void 0, void 0, function* () {
        const confirmStub = sinon
            .stub(substitute_1.SubstituteCommand.prototype, 'confirmReplacement')
            .resolves(true);
        yield modeHandler.handleMultipleKeyEvents(['i', 'f', 'f', 'b', 'a', 'r', 'f', '<Esc>']);
        yield commandLine_1.commandLine.Run('%s/f/foo/gc', modeHandler.vimState);
        testUtils_1.assertEqualLines(['foofoobarfoo']);
        confirmStub.restore();
    }));
    test('Replace across all lines', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>', 'o', 'a', 'b']);
        yield commandLine_1.commandLine.Run('%s/a/d/g', modeHandler.vimState);
        testUtils_1.assertEqualLines(['dbd', 'db']);
    }));
    newTest({
        title: 'Replace on specific single line',
        start: ['blah blah', 'bla|h', 'blah blah', 'blah blah'],
        keysPressed: ':3s/blah/yay\n',
        end: ['blah blah', 'bla|h', 'yay blah', 'blah blah'],
    });
    newTest({
        title: 'Replace on current line using dot',
        start: ['blah blah', '|blah', 'blah blah', 'blah blah'],
        keysPressed: ':.s/blah/yay\n',
        end: ['blah blah', '|yay', 'blah blah', 'blah blah'],
    });
    newTest({
        title: 'Replace single relative line using dot and plus',
        start: ['blah blah', 'bla|h', 'blah blah', 'blah blah'],
        keysPressed: ':.+2s/blah/yay\n',
        end: ['blah blah', 'bla|h', 'blah blah', 'yay blah'],
    });
    newTest({
        title: 'Replace across specific line range',
        start: ['blah blah', 'bla|h', 'blah blah', 'blah blah'],
        keysPressed: ':3,4s/blah/yay\n',
        end: ['blah blah', 'bla|h', 'yay blah', 'yay blah'],
    });
    newTest({
        title: 'Replace across relative line range using dot, plus, and minus',
        start: ['blah blah', '|blah', 'blah blah', 'blah blah'],
        keysPressed: ':.-1,.+1s/blah/yay\n',
        end: ['yay blah', '|yay', 'yay blah', 'blah blah'],
    });
    newTest({
        title: 'Replace across relative line range using numLines+colon shorthand',
        start: ['blah blah', '|blah', 'blah blah', 'blah blah'],
        keysPressed: '3:s/blah/yay\n',
        end: ['blah blah', '|yay', 'yay blah', 'yay blah'],
    });
    newTest({
        title: 'Repeat replacement across relative line range',
        start: ['|blah blah', 'blah', 'blah blah', 'blah blah'],
        keysPressed: ':s/blah/yay\nj3:s\n',
        end: ['yay blah', '|yay', 'yay blah', 'yay blah'],
    });
    newTest({
        title: 'Replace with range AND count but no flags',
        start: ['|blah blah', 'blah', 'blah blah', 'blah blah'],
        keysPressed: '3:s/blah/yay/ 2\n',
        end: ['|blah blah', 'blah', 'yay blah', 'yay blah'],
    });
    newTest({
        title: 'Undocumented: operator without LHS assumes dot as LHS',
        start: ['blah blah', 'bla|h', 'blah blah', 'blah blah'],
        keysPressed: ':+2s/blah/yay\n',
        end: ['blah blah', 'bla|h', 'blah blah', 'yay blah'],
    });
    newTest({
        title: 'Undocumented: multiple consecutive operators use 1 as RHS',
        start: ['blah blah', 'bla|h', 'blah blah', 'blah blah'],
        keysPressed: ':.++1s/blah/yay\n',
        end: ['blah blah', 'bla|h', 'blah blah', 'yay blah'],
    });
    newTest({
        title: 'Undocumented: trailing operators use 1 as RHS',
        start: ['blah blah', 'bla|h', 'blah blah', 'blah blah'],
        keysPressed: ':.+1+s/blah/yay\n',
        end: ['blah blah', 'bla|h', 'blah blah', 'yay blah'],
    });
    test('Replace specific single equal lines', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>', 'o', 'a', 'b']);
        yield commandLine_1.commandLine.Run('1,1s/a/d/g', modeHandler.vimState);
        testUtils_1.assertEqualLines(['dbd', 'ab']);
    }));
    test('Replace current line with no active selection', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            'a',
            'b',
            'a',
            '<Esc>',
            'o',
            'a',
            'b',
            '<Esc>',
        ]);
        yield commandLine_1.commandLine.Run('s/a/d/g', modeHandler.vimState);
        testUtils_1.assertEqualLines(['aba', 'db']);
    }));
    test('Replace text in selection', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            'a',
            'b',
            'a',
            '<Esc>',
            'o',
            'a',
            'b',
            '<Esc>',
            '$',
            'v',
            'k',
            '0',
        ]);
        yield commandLine_1.commandLine.Run("'<,'>s/a/d/g", modeHandler.vimState);
        testUtils_1.assertEqualLines(['dbd', 'db']);
    }));
    test('Substitute support marks', () => __awaiter(this, void 0, void 0, function* () {
        yield modeHandler.handleMultipleKeyEvents([
            'i',
            'a',
            'b',
            'c',
            '<Esc>',
            'y',
            'y',
            '2',
            'p',
            'g',
            'g',
            'm',
            'a',
            'j',
            'm',
            'b',
        ]);
        yield commandLine_1.commandLine.Run("'a,'bs/a/d/g", modeHandler.vimState);
        testUtils_1.assertEqualLines(['dbc', 'dbc', 'abc']);
    }));
    suite('Effects of substituteGlobalFlag=true', () => {
        setup(() => __awaiter(this, void 0, void 0, function* () {
            globals_1.Globals.mockConfiguration.substituteGlobalFlag = true;
            yield testUtils_1.reloadConfiguration();
        }));
        test('Replace all matches in the line', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>']);
            yield commandLine_1.commandLine.Run('%s/a/d', modeHandler.vimState);
            testUtils_1.assertEqualLines(['dbd']);
        }));
        test('Replace with `g` flag inverts global flag', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>']);
            yield commandLine_1.commandLine.Run('%s/a/d/g', modeHandler.vimState);
            testUtils_1.assertEqualLines(['dba']);
        }));
        test('Replace with `c` flag inverts global flag', () => __awaiter(this, void 0, void 0, function* () {
            const confirmStub = sinon
                .stub(substitute_1.SubstituteCommand.prototype, 'confirmReplacement')
                .resolves(true);
            yield modeHandler.handleMultipleKeyEvents(['i', 'f', 'f', 'b', 'a', 'r', 'f', '<Esc>']);
            yield commandLine_1.commandLine.Run('%s/f/foo/c', modeHandler.vimState);
            testUtils_1.assertEqualLines(['foofoobarfoo']);
            confirmStub.restore();
        }));
        test('Replace multiple lines', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>', 'o', 'a', 'b']);
            yield commandLine_1.commandLine.Run('%s/a/d/', modeHandler.vimState);
            testUtils_1.assertEqualLines(['dbd', 'db']);
        }));
        test('Replace across specific lines', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['i', 'a', 'b', 'a', '<Esc>', 'o', 'a', 'b']);
            yield commandLine_1.commandLine.Run('1,1s/a/d/', modeHandler.vimState);
            testUtils_1.assertEqualLines(['dbd', 'ab']);
        }));
        test('Replace current line with no active selection', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents([
                'i',
                'a',
                'b',
                'a',
                '<Esc>',
                'o',
                'a',
                'b',
                '<Esc>',
            ]);
            yield commandLine_1.commandLine.Run('s/a/d/', modeHandler.vimState);
            testUtils_1.assertEqualLines(['aba', 'db']);
        }));
        test('Replace text in selection', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents([
                'i',
                'a',
                'b',
                'a',
                '<Esc>',
                'o',
                'a',
                'b',
                '<Esc>',
                '$',
                'v',
                'k',
                '0',
            ]);
            yield commandLine_1.commandLine.Run("'<,'>s/a/d/", modeHandler.vimState);
            testUtils_1.assertEqualLines(['dbd', 'db']);
        }));
        test('Substitute support marks', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents([
                'i',
                'a',
                'b',
                'c',
                '<Esc>',
                'y',
                'y',
                '2',
                'p',
                'g',
                'g',
                'm',
                'a',
                'j',
                'm',
                'b',
            ]);
            yield commandLine_1.commandLine.Run("'a,'bs/a/d/", modeHandler.vimState);
            testUtils_1.assertEqualLines(['dbc', 'dbc', 'abc']);
        }));
        test('Substitute with escaped delimiter', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents(['i', 'b', '/', '/', 'f', '<Esc>']);
            yield commandLine_1.commandLine.Run('s/\\/\\/f/z/g', modeHandler.vimState);
            testUtils_1.assertEqualLines(['bz']);
        }));
    });
    suite('Substitute should use various previous search/substitute states', () => {
        test('Substitute with previous search using *', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents([
                'i',
                'f',
                'o',
                'o',
                '<Esc>',
                'o',
                'b',
                'a',
                'r',
                '<Esc>',
                'o',
                'f',
                'o',
                'o',
                '<Esc>',
                'o',
                'b',
                'a',
                'r',
                '<Esc>',
                'g',
                'g',
                '*',
            ]);
            yield commandLine_1.commandLine.Run('%s//fighters', modeHandler.vimState);
            testUtils_1.assertEqualLines(['fighters', 'bar', 'fighters', 'bar']);
        }));
        test('Substitute with previous search using #', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents([
                'i',
                'f',
                'o',
                'o',
                '<Esc>',
                'o',
                'b',
                'a',
                'r',
                '<Esc>',
                'o',
                'f',
                'o',
                'o',
                '<Esc>',
                'o',
                'b',
                'a',
                'r',
                '<Esc>',
                '#',
            ]);
            yield commandLine_1.commandLine.Run('%s//fighters', modeHandler.vimState);
            testUtils_1.assertEqualLines(['foo', 'fighters', 'foo', 'fighters']);
        }));
        test('Substitute with previous search using /', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents([
                'i',
                'f',
                'o',
                'o',
                '<Esc>',
                'o',
                'b',
                'a',
                'r',
                '<Esc>',
                'o',
                'f',
                'o',
                'o',
                '<Esc>',
                'o',
                'b',
                'a',
                'r',
                '<Esc>',
                '/',
                'f',
                'o',
                'o',
                '\n',
            ]);
            yield commandLine_1.commandLine.Run('%s//fighters', modeHandler.vimState);
            testUtils_1.assertEqualLines(['fighters', 'bar', 'fighters', 'bar']);
        }));
        newTest({
            title: 'Substitute with parameters should update search state',
            start: ['foo', 'bar', 'foo', 'bar|'],
            keysPressed: '/bar\n' + // search for bar (search state now = bar)
                ':s/ar/ite\n' + // change first bar to bite (search state now = ar, not bar)
                'n' + // repeat search (ar, not bar)
                'rr',
            end: ['foo', 'bite', 'foo', 'b|rr'],
        });
        newTest({
            title: 'Substitute with empty replacement should delete previous substitution (all variants) and accepts flags',
            start: [
                'link',
                '|ganon is here',
                'link',
                'ganon is here',
                'link',
                'ganon is here',
                'link',
                'ganon is here',
                'link',
                'ganon ganon is here',
            ],
            keysPressed: ':s/ganon/zelda\n' + // replace ganon with zelda (ensuring we have a prior replacement state)
                'n' + // find next ganon
                ':s/\n' + // replace ganon with nothing (using prior state)
                ':s/ganon/zelda\n' + // does nothing (just ensuring we have a prior replacement state)
                'n' + // find next ganon
                ':s//\n' + // replace ganon with nothing (using prior state)
                'n' + // find next ganon
                ':s/ganon\n' + // replace ganon with nothing (using single input)
                ':s/ganon/zelda\n' + // does nothing (just ensuring we have a prior replacement state)
                'n' + // find next ganon
                ':s///g\n',
            end: [
                'link',
                'zelda is here',
                'link',
                ' is here',
                'link',
                ' is here',
                'link',
                ' is here',
                'link',
                '|  is here',
            ],
        });
        newTest({
            title: 'Substitute with no pattern should repeat previous substitution and not alter search state',
            start: ['|link', 'zelda', 'link', 'zelda', 'link'],
            keysPressed: ':s/ink/egend\n' + // replace link with legend (search state now = egend, and substitute state set)
                '/link\n' + // search for link (search state now = link, not ink)
                ':s\n' + // repeat replacement (using substitute state, so ink, not link - note: search state should NOT change)
                'n' + // repeat search for link, not ink
                'rp',
            end: ['legend', 'zelda', 'legend', 'zelda', '|pink'],
        });
        newTest({
            title: 'Substitute repeat previous should accept flags',
            start: ['|fooo'],
            keysPressed: ':s/o/un\n:s g\n',
            end: ['|fununun'],
        });
        test('Substitute with empty search string should use last searched pattern', () => __awaiter(this, void 0, void 0, function* () {
            yield modeHandler.handleMultipleKeyEvents([
                'i',
                'f',
                'o',
                'o',
                '<Esc>',
                'o',
                'b',
                'a',
                'r',
                '<Esc>',
                'o',
                'f',
                'o',
                'o',
                '<Esc>',
                'o',
                'b',
                'a',
                'r',
                '<Esc>',
                '/',
                'f',
                'o',
                'o',
                '\n',
                '2',
                'g',
                'g',
                '*',
            ]);
            yield commandLine_1.commandLine.Run('%s//fighters', modeHandler.vimState);
            testUtils_1.assertEqualLines(['foo', 'fighters', 'foo', 'fighters']);
        }));
        newTest({
            title: 'Ampersand (&) should repeat the last substitution',
            start: ['|foo bar baz'],
            keysPressed: ':s/ba/t\n' + '&',
            end: ['|foo tr tz'],
        });
    });
});

//# sourceMappingURL=substitute.test.js.map
