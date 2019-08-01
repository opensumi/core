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
const position_1 = require("./../src/common/motion/position");
const textEditor_1 = require("./../src/textEditor");
const testUtils_1 = require("./testUtils");
suite('basic motion', () => {
    let text = ['mary had', 'a', 'little lamb', ' whose fleece was '];
    suiteSetup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        yield textEditor_1.TextEditor.insert(text.join('\n'));
    }));
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    test('char right: should move one column right', () => {
        let position = new position_1.Position(0, 0);
        assert.equal(position.line, 0);
        assert.equal(position.character, 0);
        let next = position.getRight();
        assert.equal(next.line, 0);
        assert.equal(next.character, 1);
    });
    test('char right', () => {
        let motion = new position_1.Position(0, 9);
        motion = motion.getRight();
        assert.equal(motion.line, 0);
        assert.equal(motion.character, 9);
    });
    test('char left: should move cursor one column left', () => {
        let position = new position_1.Position(0, 5);
        assert.equal(position.line, 0);
        assert.equal(position.character, 5);
        position = position.getLeft();
        assert.equal(position.line, 0);
        assert.equal(position.character, 4);
    });
    test('char left: left-most column should stay at the same location', () => {
        let motion = new position_1.Position(0, 0);
        assert.equal(motion.line, 0);
        assert.equal(motion.character, 0);
        motion = motion.getLeft();
        assert.equal(motion.line, 0);
        assert.equal(motion.character, 0);
    });
    test('line down: should move cursor one line down', () => {
        let motion = new position_1.Position(1, 0);
        assert.equal(motion.line, 1);
        assert.equal(motion.character, 0);
        motion = motion.getDown(0);
        assert.equal(motion.line, 2);
        assert.equal(motion.character, 0);
    });
    test('line down: bottom-most line should stay at the same location', () => {
        let motion = new position_1.Position(3, 0);
        assert.equal(motion.line, 3);
        assert.equal(motion.character, 0);
        motion = motion.getDown(3);
        assert.equal(motion.line, 3);
        assert.equal(motion.character, 0);
    });
    suite('line up', () => {
        test('should move cursor one line up', () => {
            let position = new position_1.Position(1, 0);
            assert.equal(position.line, 1);
            assert.equal(position.character, 0);
            position = position.getUp(0);
            assert.equal(position.line, 0);
            assert.equal(position.character, 0);
        });
        test('top-most line should stay at the same location', () => {
            let motion = new position_1.Position(0, 1);
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 1);
            motion = motion.getUp(0);
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 1);
        });
    });
    test('line begin', () => {
        let motion = new position_1.Position(0, 3).getLineBegin();
        assert.equal(motion.line, 0);
        assert.equal(motion.character, 0);
    });
    test('line end', () => {
        let motion = new position_1.Position(0, 0).getLineEnd();
        assert.equal(motion.line, 0);
        assert.equal(motion.character, text[0].length);
        motion = new position_1.Position(2, 0).getLineEnd();
        assert.equal(motion.line, 2);
        assert.equal(motion.character, text[2].length);
    });
    test('document begin', () => {
        let motion = new position_1.Position(1, 0).getDocumentBegin();
        assert.equal(motion.line, 0);
        assert.equal(motion.character, 0);
    });
    test('document end', () => {
        let motion = new position_1.Position(0, 0).getDocumentEnd();
        assert.equal(motion.line, text.length - 1);
        assert.equal(motion.character, text[text.length - 1].length);
    });
    test('line begin cursor on first non-blank character', () => {
        let motion = new position_1.Position(0, 3).getFirstLineNonBlankChar();
        assert.equal(motion.line, 0);
        assert.equal(motion.character, 0);
    });
    test('last line begin cursor on first non-blank character', () => {
        let motion = new position_1.Position(3, 0).getFirstLineNonBlankChar();
        assert.equal(motion.line, 3);
        assert.equal(motion.character, 1);
    });
});
suite('word motion', () => {
    let text = [
        'if (true) {',
        '  return true;',
        '} else {',
        '',
        '  return false;',
        '  ',
        '} // endif',
    ];
    suiteSetup(() => {
        return testUtils_1.setupWorkspace().then(() => {
            return textEditor_1.TextEditor.insert(text.join('\n'));
        });
    });
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    suite('word right', () => {
        test('move to word right', () => {
            let motion = new position_1.Position(0, 3).getWordRight();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 4);
        });
        test('last word should move to next line', () => {
            let motion = new position_1.Position(0, 10).getWordRight();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 2);
        });
        test('last word should move to next line stops on empty line', () => {
            let motion = new position_1.Position(2, 7).getWordRight();
            assert.equal(motion.line, 3);
            assert.equal(motion.character, 0);
        });
        test('last word should move to next line skips whitespace only line', () => {
            let motion = new position_1.Position(4, 14).getWordRight();
            assert.equal(motion.line, 6);
            assert.equal(motion.character, 0);
        });
        test('last word on last line should go to end of document (special case!)', () => {
            let motion = new position_1.Position(6, 6).getWordRight();
            assert.equal(motion.line, 6);
            assert.equal(motion.character, 10);
        });
    });
    suite('word left', () => {
        test('move cursor word left across spaces', () => {
            let motion = new position_1.Position(0, 3).getWordLeft();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 0);
        });
        test('move cursor word left within word', () => {
            let motion = new position_1.Position(0, 5).getWordLeft();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 4);
        });
        test('first word should move to previous line, beginning of last word', () => {
            let motion = new position_1.Position(1, 2).getWordLeft();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 10);
        });
        test('first word should move to previous line, stops on empty line', () => {
            let motion = new position_1.Position(4, 2).getWordLeft();
            assert.equal(motion.line, 3);
            assert.equal(motion.character, 0);
        });
        test('first word should move to previous line, skips whitespace only line', () => {
            let motion = new position_1.Position(6, 0).getWordLeft();
            assert.equal(motion.line, 4);
            assert.equal(motion.character, 14);
        });
    });
    suite('WORD right', () => {
        test('move to WORD right', () => {
            let motion = new position_1.Position(0, 3).getBigWordRight();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 10);
        });
        test('last WORD should move to next line', () => {
            let motion = new position_1.Position(1, 10).getBigWordRight();
            assert.equal(motion.line, 2);
            assert.equal(motion.character, 0);
        });
        test('last WORD should move to next line stops on empty line', () => {
            let motion = new position_1.Position(2, 7).getBigWordRight();
            assert.equal(motion.line, 3);
            assert.equal(motion.character, 0);
        });
        test('last WORD should move to next line skips whitespace only line', () => {
            let motion = new position_1.Position(4, 12).getBigWordRight();
            assert.equal(motion.line, 6);
            assert.equal(motion.character, 0);
        });
    });
    suite('WORD left', () => {
        test('move cursor WORD left across spaces', () => {
            let motion = new position_1.Position(0, 3).getBigWordLeft();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 0);
        });
        test('move cursor WORD left within WORD', () => {
            let motion = new position_1.Position(0, 5).getBigWordLeft();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 3);
        });
        test('first WORD should move to previous line, beginning of last WORD', () => {
            let motion = new position_1.Position(2, 0).getBigWordLeft();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 9);
        });
        test('first WORD should move to previous line, stops on empty line', () => {
            let motion = new position_1.Position(4, 2).getBigWordLeft();
            assert.equal(motion.line, 3);
            assert.equal(motion.character, 0);
        });
        test('first WORD should move to previous line, skips whitespace only line', () => {
            let motion = new position_1.Position(6, 0).getBigWordLeft();
            assert.equal(motion.line, 4);
            assert.equal(motion.character, 9);
        });
    });
    suite('end of word right', () => {
        test('move to end of current word right', () => {
            let motion = new position_1.Position(0, 4).getCurrentWordEnd();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 7);
        });
        test('move to end of next word right', () => {
            let motion = new position_1.Position(0, 7).getCurrentWordEnd();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 8);
        });
        test('end of last word should move to next line', () => {
            let motion = new position_1.Position(0, 10).getCurrentWordEnd();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 7);
        });
        test('end of last word should move to next line skips empty line', () => {
            let motion = new position_1.Position(2, 7).getCurrentWordEnd();
            assert.equal(motion.line, 4);
            assert.equal(motion.character, 7);
        });
        test('end of last word should move to next line skips whitespace only line', () => {
            let motion = new position_1.Position(4, 14).getCurrentWordEnd();
            assert.equal(motion.line, 6);
            assert.equal(motion.character, 0);
        });
    });
    suite('end of WORD right', () => {
        test('move to end of current WORD right', () => {
            let motion = new position_1.Position(0, 4).getCurrentBigWordEnd();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 8);
        });
        test('move to end of next WORD right', () => {
            let motion = new position_1.Position(0, 8).getCurrentBigWordEnd();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 10);
        });
        test('end of last WORD should move to next line', () => {
            let motion = new position_1.Position(0, 10).getCurrentBigWordEnd();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 7);
        });
        test('end of last WORD should move to next line skips empty line', () => {
            let motion = new position_1.Position(2, 7).getCurrentBigWordEnd();
            assert.equal(motion.line, 4);
            assert.equal(motion.character, 7);
        });
        test('end of last WORD should move to next line skips whitespace only line', () => {
            let motion = new position_1.Position(4, 14).getCurrentBigWordEnd();
            assert.equal(motion.line, 6);
            assert.equal(motion.character, 0);
        });
    });
    test('line begin cursor on first non-blank character', () => {
        let motion = new position_1.Position(4, 3).getFirstLineNonBlankChar();
        assert.equal(motion.line, 4);
        assert.equal(motion.character, 2);
    });
    test('last line begin cursor on first non-blank character', () => {
        let motion = new position_1.Position(6, 0).getFirstLineNonBlankChar();
        assert.equal(motion.line, 6);
        assert.equal(motion.character, 0);
    });
});
suite('unicode word motion', () => {
    let text = [
        '漢字ひらがなカタカナalphabets、いろいろな文字。',
        'Καλημέρα κόσμε',
        'Die früh sich einst dem trüben Blick gezeigt.',
        'Được tiếp đãi ân cần',
        '100£and100$and100¥#♯x',
    ];
    suiteSetup(() => {
        return testUtils_1.setupWorkspace().then(() => {
            return textEditor_1.TextEditor.insert(text.join('\n'));
        });
    });
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    suite('word right', () => {
        test('move cursor word right stops at different kind of character (ideograph -> hiragana)', () => {
            let motion = new position_1.Position(0, 0).getWordRight();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 2);
        });
        test('move cursor word right stops at different kind of character (katakana -> ascii)', () => {
            let motion = new position_1.Position(0, 7).getWordRight();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 10);
        });
        test('move cursor word right stops at different kind of chararacter (ascii -> punctuation)', () => {
            let motion = new position_1.Position(0, 10).getWordRight();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 19);
        });
        test('move cursor word right on non-ascii text', () => {
            let motion = new position_1.Position(1, 0).getWordRight();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 9);
        });
        test('move cursor word right recognizes a latin string which has diacritics as a single word', () => {
            let motion = new position_1.Position(2, 4).getWordRight();
            assert.equal(motion.line, 2);
            assert.equal(motion.character, 9);
        });
        test('move cursor word right recognizes a latin-1 symbol as punctuation', () => {
            let motion = new position_1.Position(4, 3).getWordRight();
            assert.equal(motion.line, 4);
            assert.equal(motion.character, 4);
            motion = motion.getWordRight(); // issue #3680
            assert.equal(motion.line, 4);
            assert.equal(motion.character, 10);
        });
        test('move cursor word right recognizes a sequence of latin-1 symbols and other symbols as a word', () => {
            let motion = new position_1.Position(4, 17).getWordRight();
            assert.equal(motion.line, 4);
            assert.equal(motion.character, 20);
        });
    });
    suite('word left', () => {
        test('move cursor word left across the different char kind', () => {
            let motion = new position_1.Position(0, 2).getWordLeft();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 0);
        });
        test('move cursor word left within the same char kind', () => {
            let motion = new position_1.Position(0, 5).getWordLeft();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 2);
        });
        test('move cursor word left across spaces on non-ascii text', () => {
            let motion = new position_1.Position(1, 9).getWordLeft();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 0);
        });
        test('move cursor word left within word on non-ascii text', () => {
            let motion = new position_1.Position(1, 11).getWordLeft();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 9);
        });
        test('move cursor word left recognizes a latin string which has diacritics as a single word', () => {
            let motion = new position_1.Position(3, 10).getWordLeft();
            assert.equal(motion.line, 3);
            assert.equal(motion.character, 5);
        });
    });
});
suite('sentence motion', () => {
    let text = [
        'This text has many sections in it. What do you think?',
        '',
        'A paragraph boundary is also a sentence boundry, see',
        '',
        'Weird things happen when there is no appropriate sentence ending',
        '',
        'Next line is just whitespace',
        '   ',
        'Wow!',
        'Another sentence inside one paragraph.',
    ];
    suiteSetup(() => {
        return testUtils_1.setupWorkspace().then(() => {
            return textEditor_1.TextEditor.insert(text.join('\n'));
        });
    });
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    suite('sentence forward', () => {
        test('next concrete sentence', () => {
            let motion = new position_1.Position(0, 0).getSentenceBegin({ forward: true });
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 35);
        });
        test('next sentence that ends with paragraph ending', () => {
            let motion = new position_1.Position(2, 50).getNextLineBegin();
            assert.equal(motion.line, 3);
            assert.equal(motion.character, 0);
        });
        test('next sentence when cursor is at the end of previous paragraph', () => {
            let motion = new position_1.Position(3, 0).getSentenceBegin({ forward: true });
            assert.equal(motion.line, 4);
            assert.equal(motion.character, 0);
        });
        test('next sentence when paragraph contains a line of whilte spaces', () => {
            let motion = new position_1.Position(6, 2).getSentenceBegin({ forward: true });
            assert.equal(motion.line, 9);
            assert.equal(motion.character, 0);
        });
    });
    suite('sentence backward', () => {
        test('current sentence begin', () => {
            let motion = new position_1.Position(0, 37).getSentenceBegin({ forward: false });
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 35);
        });
        test('sentence forward when cursor is at the beginning of the second sentence', () => {
            let motion = new position_1.Position(0, 35).getSentenceBegin({ forward: false });
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 0);
        });
        test('current sentence begin with no concrete sentense inside', () => {
            let motion = new position_1.Position(3, 0).getSentenceBegin({ forward: false });
            assert.equal(motion.line, 2);
            assert.equal(motion.character, 0);
        });
        test("current sentence begin when it's not the same as current paragraph begin", () => {
            let motion = new position_1.Position(2, 0).getSentenceBegin({ forward: false });
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 0);
        });
        test('current sentence begin when previous line ends with a concrete sentence', () => {
            let motion = new position_1.Position(9, 5).getSentenceBegin({ forward: false });
            assert.equal(motion.line, 9);
            assert.equal(motion.character, 0);
        });
    });
});
suite('paragraph motion', () => {
    let text = [
        'this text has',
        '',
        'many',
        'paragraphs',
        '',
        '',
        'in it.',
        '',
        'WOW',
    ];
    suiteSetup(() => {
        return testUtils_1.setupWorkspace().then(() => {
            return textEditor_1.TextEditor.insert(text.join('\n'));
        });
    });
    suiteTeardown(testUtils_1.cleanUpWorkspace);
    suite('paragraph down', () => {
        test('move down normally', () => {
            let motion = new position_1.Position(0, 0).getCurrentParagraphEnd();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 0);
        });
        test('move down longer paragraph', () => {
            let motion = new position_1.Position(2, 0).getCurrentParagraphEnd();
            assert.equal(motion.line, 4);
            assert.equal(motion.character, 0);
        });
        test('move down starting inside empty line', () => {
            let motion = new position_1.Position(4, 0).getCurrentParagraphEnd();
            assert.equal(motion.line, 7);
            assert.equal(motion.character, 0);
        });
        test('paragraph at end of document', () => {
            let motion = new position_1.Position(7, 0).getCurrentParagraphEnd();
            assert.equal(motion.line, 8);
            assert.equal(motion.character, 3);
        });
    });
    suite('paragraph up', () => {
        test('move up short paragraph', () => {
            let motion = new position_1.Position(1, 0).getCurrentParagraphBeginning();
            assert.equal(motion.line, 0);
            assert.equal(motion.character, 0);
        });
        test('move up longer paragraph', () => {
            let motion = new position_1.Position(3, 0).getCurrentParagraphBeginning();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 0);
        });
        test('move up starting inside empty line', () => {
            let motion = new position_1.Position(5, 0).getCurrentParagraphBeginning();
            assert.equal(motion.line, 1);
            assert.equal(motion.character, 0);
        });
    });
});

//# sourceMappingURL=motion.test.js.map
