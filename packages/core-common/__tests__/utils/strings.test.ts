// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/strings.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as strings from '../../src/utils/strings';

describe('Strings', () => {
	test('equalsIgnoreCase', () => {
		expect(strings.equalsIgnoreCase('', '')).toBeTruthy();
		expect(!strings.equalsIgnoreCase('', '1')).toBeTruthy();
		expect(!strings.equalsIgnoreCase('1', '')).toBeTruthy();

		expect(strings.equalsIgnoreCase('a', 'a')).toBeTruthy();
		expect(strings.equalsIgnoreCase('abc', 'Abc')).toBeTruthy();
		expect(strings.equalsIgnoreCase('abc', 'ABC')).toBeTruthy();
		expect(strings.equalsIgnoreCase('Höhenmeter', 'HÖhenmeter')).toBeTruthy();
		expect(strings.equalsIgnoreCase('ÖL', 'Öl')).toBeTruthy();
	});

	test('beginsWithIgnoreCase', () => {
		expect(strings.startsWithIgnoreCase('', '')).toBeTruthy();
		expect(!strings.startsWithIgnoreCase('', '1')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('1', '')).toBeTruthy();

		expect(strings.startsWithIgnoreCase('a', 'a')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('abc', 'Abc')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('abc', 'ABC')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('Höhenmeter', 'HÖhenmeter')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('ÖL', 'Öl')).toBeTruthy();

		expect(strings.startsWithIgnoreCase('alles klar', 'a')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('alles klar', 'A')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('alles klar', 'alles k')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('alles klar', 'alles K')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('alles klar', 'ALLES K')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('alles klar', 'alles klar')).toBeTruthy();
		expect(strings.startsWithIgnoreCase('alles klar', 'ALLES KLAR')).toBeTruthy();

		expect(!strings.startsWithIgnoreCase('alles klar', ' ALLES K')).toBeTruthy();
		expect(!strings.startsWithIgnoreCase('alles klar', 'ALLES K ')).toBeTruthy();
		expect(!strings.startsWithIgnoreCase('alles klar', 'öALLES K ')).toBeTruthy();
		expect(!strings.startsWithIgnoreCase('alles klar', ' ')).toBeTruthy();
		expect(!strings.startsWithIgnoreCase('alles klar', 'ö')).toBeTruthy();
	});

	test('compareIgnoreCase', () => {

		function assertCompareIgnoreCase(a: string, b: string, recurse = true): void {
			let actual = strings.compareIgnoreCase(a, b);
			actual = actual > 0 ? 1 : actual < 0 ? -1 : actual;

			let expected = strings.compare(a.toLowerCase(), b.toLowerCase());
			expected = expected > 0 ? 1 : expected < 0 ? -1 : expected;
			expect(actual).toEqual(expected);

			if (recurse) {
				assertCompareIgnoreCase(b, a, false);
			}
		}

		assertCompareIgnoreCase('', '');
		assertCompareIgnoreCase('abc', 'ABC');
		assertCompareIgnoreCase('abc', 'ABc');
		assertCompareIgnoreCase('abc', 'ABcd');
		assertCompareIgnoreCase('abc', 'abcd');
		assertCompareIgnoreCase('foo', 'föo');
		assertCompareIgnoreCase('Code', 'code');
		assertCompareIgnoreCase('Code', 'cöde');

		assertCompareIgnoreCase('B', 'a');
		assertCompareIgnoreCase('a', 'B');
		assertCompareIgnoreCase('b', 'a');
		assertCompareIgnoreCase('a', 'b');

		assertCompareIgnoreCase('aa', 'ab');
		assertCompareIgnoreCase('aa', 'aB');
		assertCompareIgnoreCase('aa', 'aA');
		assertCompareIgnoreCase('a', 'aa');
		assertCompareIgnoreCase('ab', 'aA');
		assertCompareIgnoreCase('O', '/');
	});

	test('format', () => {
		expect(strings.format('Foo Bar')).toBe('Foo Bar');
		expect(strings.format('Foo {0} Bar')).toBe('Foo {0} Bar');
		expect(strings.format('Foo {0} Bar', 'yes')).toBe('Foo yes Bar');
		expect(strings.format('Foo {0} Bar {0}', 'yes')).toBe('Foo yes Bar yes');
		expect(strings.format('Foo {0} Bar {1}{2}', 'yes')).toBe('Foo yes Bar {1}{2}');
		expect(strings.format('Foo {0} Bar {1}{2}', 'yes', undefined)).toBe('Foo yes Bar undefined{2}');
		expect(strings.format('Foo {0} Bar {1}{2}', 'yes', 5, false)).toBe('Foo yes Bar 5false');
		expect(strings.format('Foo {0} Bar. {1}', '(foo)', '.test')).toBe('Foo (foo) Bar. .test');
	});

	test('overlap', () => {
		expect(strings.overlap('foobar', 'arr, I am a priate')).toEqual(2);
		expect(strings.overlap('no', 'overlap')).toEqual(1);
		expect(strings.overlap('no', '0verlap')).toEqual(0);
		expect(strings.overlap('nothing', '')).toEqual(0);
		expect(strings.overlap('', 'nothing')).toEqual(0);
		expect(strings.overlap('full', 'full')).toEqual(4);
		expect(strings.overlap('full', 'fulloverlap')).toEqual(4);
	});
	test('lcut', () => {
		expect(strings.lcut('foo bar', 0)).toBe('');
		expect(strings.lcut('foo bar', 1)).toBe('bar');
		expect(strings.lcut('foo bar', 3)).toBe('bar');
		expect(strings.lcut('foo bar', 4)).toBe('bar'); // Leading whitespace trimmed
		expect(strings.lcut('foo bar', 5)).toBe('foo bar');
		expect(strings.lcut('test string 0.1.2.3', 3)).toBe('2.3');

		expect(strings.lcut('', 10)).toBe('');
		expect(strings.lcut('a', 10)).toBe('a');
	});

	test('pad', () => {
		expect(strings.pad(1, 0)).toBe('1');
		expect(strings.pad(1, 1)).toBe('1');
		expect(strings.pad(1, 2)).toBe('01');
		expect(strings.pad(0, 2)).toBe('00');
	});

	test('escape', () => {
		expect(strings.escape('')).toBe('');
		expect(strings.escape('foo')).toBe('foo');
		expect(strings.escape('foo bar')).toBe('foo bar');
		expect(strings.escape('<foo bar>')).toBe('&lt;foo bar&gt;');
		expect(strings.escape('<foo>Hello</foo>')).toBe('&lt;foo&gt;Hello&lt;/foo&gt;');
	});

	test('startsWith', () => {
		expect(strings.startsWith('foo', 'f')).toBeTruthy();
		expect(strings.startsWith('foo', 'fo')).toBeTruthy();
		expect(strings.startsWith('foo', 'foo')).toBeTruthy();
		expect(!strings.startsWith('foo', 'o')).toBeTruthy();
		expect(!strings.startsWith('', 'f')).toBeTruthy();
		expect(strings.startsWith('foo', '')).toBeTruthy();
		expect(strings.startsWith('', '')).toBeTruthy();
	});

	test('endsWith', () => {
		expect(strings.endsWith('foo', 'o')).toBeTruthy();
		expect(strings.endsWith('foo', 'oo')).toBeTruthy();
		expect(strings.endsWith('foo', 'foo')).toBeTruthy();
		expect(strings.endsWith('foo bar foo', 'foo')).toBeTruthy();
		expect(!strings.endsWith('foo', 'f')).toBeTruthy();
		expect(!strings.endsWith('', 'f')).toBeTruthy();
		expect(strings.endsWith('foo', '')).toBeTruthy();
		expect(strings.endsWith('', '')).toBeTruthy();
		expect(strings.endsWith('/', '/')).toBeTruthy();
	});

	test('ltrim', () => {
		expect(strings.ltrim('foo', 'f')).toBe('oo');
		expect(strings.ltrim('foo', 'o')).toBe('foo');
		expect(strings.ltrim('http://www.test.de', 'http://')).toBe('www.test.de');
		expect(strings.ltrim('/foo/', '/')).toBe('foo/');
		expect(strings.ltrim('//foo/', '/')).toBe('foo/');
		expect(strings.ltrim('/', '')).toBe('/');
		expect(strings.ltrim('/', '/')).toBe('');
		expect(strings.ltrim('///', '/')).toBe('');
		expect(strings.ltrim('', '')).toBe('');
		expect(strings.ltrim('', '/')).toBe('');
	});

	test('rtrim', () => {
		expect(strings.rtrim('foo', 'o')).toBe('f');
		expect(strings.rtrim('foo', 'f')).toBe('foo');
		expect(strings.rtrim('http://www.test.de', '.de')).toBe('http://www.test');
		expect(strings.rtrim('/foo/', '/')).toBe('/foo');
		expect(strings.rtrim('/foo//', '/')).toBe('/foo');
		expect(strings.rtrim('/', '')).toBe('/');
		expect(strings.rtrim('/', '/')).toBe('');
		expect(strings.rtrim('///', '/')).toBe('');
		expect(strings.rtrim('', '')).toBe('');
		expect(strings.rtrim('', '/')).toBe('');
	});

	test('trim', () => {
		expect(strings.trim(' foo ')).toBe('foo');
		expect(strings.trim('  foo')).toBe('foo');
		expect(strings.trim('bar  ')).toBe('bar');
		expect(strings.trim('   ')).toBe('');
		expect(strings.trim('foo bar', 'bar')).toBe('foo ');
	});

  test('multiRightTrim', () => {
    expect(strings.multiRightTrim(' foo ,', [','])).toBe(' foo ');
    expect(strings.multiRightTrim('foo;,', [',', ';'])).toBe('foo');
    expect(strings.multiRightTrim('/path/to/a.java;', [';'])).toBe('/path/to/a.java');
    expect(strings.multiRightTrim('/path/to/a.ts,', [','])).toBe('/path/to/a.ts');
  });

	test('trimWhitespace', () => {
		expect(' foo '.trim()).toBe('foo');
		expect('	 foo	'.trim()).toBe('foo');
		expect('  foo'.trim()).toBe('foo');
		expect('bar  '.trim()).toBe('bar');
		expect('   '.trim()).toBe('');
		expect(' 	  '.trim()).toBe('');
	});

	test('repeat', () => {
		expect(strings.repeat(' ', 4)).toBe('    ');
		expect(strings.repeat(' ', 1)).toBe(' ');
		expect(strings.repeat(' ', 0)).toBe('');
		expect(strings.repeat('abc', 2)).toBe('abcabc');
	});

	test('lastNonWhitespaceIndex', () => {
		expect(strings.lastNonWhitespaceIndex('abc  \t \t ')).toBe(2);
		expect(strings.lastNonWhitespaceIndex('abc')).toBe(2);
		expect(strings.lastNonWhitespaceIndex('abc\t')).toBe(2);
		expect(strings.lastNonWhitespaceIndex('abc ')).toBe(2);
		expect(strings.lastNonWhitespaceIndex('abc  \t \t ')).toBe(2);
		expect(strings.lastNonWhitespaceIndex('abc  \t \t abc \t \t ')).toBe(11);
		expect(strings.lastNonWhitespaceIndex('abc  \t \t abc \t \t ', 8)).toBe(2);
		expect(strings.lastNonWhitespaceIndex('  \t \t ')).toBe(-1);
	});

	test('containsRTL', () => {
		expect(strings.containsRTL('a')).toEqual(false);
		expect(strings.containsRTL('')).toEqual(false);
		expect(strings.containsRTL(strings.UTF8_BOM_CHARACTER + 'a')).toEqual(false);
		expect(strings.containsRTL('hello world!')).toEqual(false);
		expect(strings.containsRTL('a📚📚b')).toEqual(false);
		expect(strings.containsRTL('هناك حقيقة مثبتة منذ زمن طويل')).toEqual(true);
		expect(strings.containsRTL('זוהי עובדה מבוססת שדעתו')).toEqual(true);
	});

	test('containsEmoji', () => {
		expect(strings.containsEmoji('a')).toEqual(false);
		expect(strings.containsEmoji('')).toEqual(false);
		expect(strings.containsEmoji(strings.UTF8_BOM_CHARACTER + 'a')).toEqual(false);
		expect(strings.containsEmoji('hello world!')).toEqual(false);
		expect(strings.containsEmoji('هناك حقيقة مثبتة منذ زمن طويل')).toEqual(false);
		expect(strings.containsEmoji('זוהי עובדה מבוססת שדעתו')).toEqual(false);

		expect(strings.containsEmoji('a📚📚b')).toEqual(true);
		expect(strings.containsEmoji('1F600 # 😀 grinning face')).toEqual(true);
		expect(strings.containsEmoji('1F47E # 👾 alien monster')).toEqual(true);
		expect(strings.containsEmoji('1F467 1F3FD # 👧🏽 girl: medium skin tone')).toEqual(true);
		expect(strings.containsEmoji('26EA # ⛪ church')).toEqual(true);
		expect(strings.containsEmoji('231B # ⌛ hourglass')).toEqual(true);
		expect(strings.containsEmoji('2702 # ✂ scissors')).toEqual(true);
		expect(strings.containsEmoji('1F1F7 1F1F4  # 🇷🇴 Romania')).toEqual(true);
	});

	test('isBasicASCII', () => {
		function assertIsBasicASCII(str: string, expected: boolean): void {
			expect(strings.isBasicASCII(str)).toEqual(expected);
		}
		assertIsBasicASCII('abcdefghijklmnopqrstuvwxyz', true);
		assertIsBasicASCII('ABCDEFGHIJKLMNOPQRSTUVWXYZ', true);
		assertIsBasicASCII('1234567890', true);
		assertIsBasicASCII('`~!@#$%^&*()-_=+[{]}\\|;:\'",<.>/?', true);
		assertIsBasicASCII(' ', true);
		assertIsBasicASCII('\t', true);
		assertIsBasicASCII('\n', true);
		assertIsBasicASCII('\r', true);

		let ALL = '\r\t\n';
		for (let i = 32; i < 127; i++) {
			ALL += String.fromCharCode(i);
		}
		assertIsBasicASCII(ALL, true);

		assertIsBasicASCII(String.fromCharCode(31), false);
		assertIsBasicASCII(String.fromCharCode(127), false);
		assertIsBasicASCII('ü', false);
		assertIsBasicASCII('a📚📚b', false);
	});

	test('createRegExp', () => {
		// Empty
		expect(() => strings.createRegExp('', false)).toThrow();

		// Escapes appropriately
		expect(strings.createRegExp('abc', false).source).toEqual('abc');
		expect(strings.createRegExp('([^ ,.]*)', false).source).toEqual('\\(\\[\\^ ,\\.\\]\\*\\)');
		expect(strings.createRegExp('([^ ,.]*)', true).source).toEqual('([^ ,.]*)');

		// Whole word
		expect(strings.createRegExp('abc', false, { wholeWord: true }).source).toEqual('\\babc\\b');
		expect(strings.createRegExp('abc', true, { wholeWord: true }).source).toEqual('\\babc\\b');
		expect(strings.createRegExp(' abc', true, { wholeWord: true }).source).toEqual(' abc\\b');
		expect(strings.createRegExp('abc ', true, { wholeWord: true }).source).toEqual('\\babc ');
		expect(strings.createRegExp(' abc ', true, { wholeWord: true }).source).toEqual(' abc ');

		const regExpWithoutFlags = strings.createRegExp('abc', true);
		expect(!regExpWithoutFlags.global).toBeTruthy();
		expect(regExpWithoutFlags.ignoreCase).toBeTruthy();
		expect(!regExpWithoutFlags.multiline).toBeTruthy();

		const regExpWithFlags = strings.createRegExp('abc', true, { global: true, matchCase: true, multiline: true });
		expect(regExpWithFlags.global).toBeTruthy();
		expect(!regExpWithFlags.ignoreCase).toBeTruthy();
		expect(regExpWithFlags.multiline).toBeTruthy();
	});

	test('regExpContainsBackreference', () => {
		expect(strings.regExpContainsBackreference('foo \\5 bar')).toBeTruthy();
		expect(strings.regExpContainsBackreference('\\2')).toBeTruthy();
		expect(strings.regExpContainsBackreference('(\\d)(\\n)(\\1)')).toBeTruthy();
		expect(strings.regExpContainsBackreference('(A).*?\\1')).toBeTruthy();
		expect(strings.regExpContainsBackreference('\\\\\\1')).toBeTruthy();
		expect(strings.regExpContainsBackreference('foo \\\\\\1')).toBeTruthy();

		expect(!strings.regExpContainsBackreference('')).toBeTruthy();
		expect(!strings.regExpContainsBackreference('\\\\1')).toBeTruthy();
		expect(!strings.regExpContainsBackreference('foo \\\\1')).toBeTruthy();
		expect(!strings.regExpContainsBackreference('(A).*?\\\\1')).toBeTruthy();
		expect(!strings.regExpContainsBackreference('foo \\d1 bar')).toBeTruthy();
		expect(!strings.regExpContainsBackreference('123')).toBeTruthy();
	});

	test('getLeadingWhitespace', () => {
		expect(strings.getLeadingWhitespace('  foo')).toEqual('  ');
		expect(strings.getLeadingWhitespace('  foo', 2)).toEqual('');
		expect(strings.getLeadingWhitespace('  foo', 1, 1)).toEqual('');
		expect(strings.getLeadingWhitespace('  foo', 0, 1)).toEqual(' ');
		expect(strings.getLeadingWhitespace('  ')).toEqual('  ');
		expect(strings.getLeadingWhitespace('  ', 1)).toEqual(' ');
		expect(strings.getLeadingWhitespace('  ', 0, 1)).toEqual(' ');
		expect(strings.getLeadingWhitespace('\t\tfunction foo(){', 0, 1)).toEqual('\t');
		expect(strings.getLeadingWhitespace('\t\tfunction foo(){', 0, 2)).toEqual('\t\t');
	});

	test('fuzzyContains', () => {
		expect(!strings.fuzzyContains((undefined)!, null!)).toBeTruthy();
		expect(strings.fuzzyContains('hello world', 'h')).toBeTruthy();
		expect(!strings.fuzzyContains('hello world', 'q')).toBeTruthy();
		expect(strings.fuzzyContains('hello world', 'hw')).toBeTruthy();
		expect(strings.fuzzyContains('hello world', 'horl')).toBeTruthy();
		expect(strings.fuzzyContains('hello world', 'd')).toBeTruthy();
		expect(!strings.fuzzyContains('hello world', 'wh')).toBeTruthy();
		expect(!strings.fuzzyContains('d', 'dd')).toBeTruthy();
	});

	test('startsWithUTF8BOM', () => {
		expect(strings.startsWithUTF8BOM(strings.UTF8_BOM_CHARACTER)).toBeTruthy();
		expect(strings.startsWithUTF8BOM(strings.UTF8_BOM_CHARACTER + 'a')).toBeTruthy();
		expect(strings.startsWithUTF8BOM(strings.UTF8_BOM_CHARACTER + 'aaaaaaaaaa')).toBeTruthy();
		expect(!strings.startsWithUTF8BOM(' ' + strings.UTF8_BOM_CHARACTER)).toBeTruthy();
		expect(!strings.startsWithUTF8BOM('foo')).toBeTruthy();
		expect(!strings.startsWithUTF8BOM('')).toBeTruthy();
	});

	test('stripUTF8BOM', () => {
		expect(strings.stripUTF8BOM(strings.UTF8_BOM_CHARACTER)).toEqual('');
		expect(strings.stripUTF8BOM(strings.UTF8_BOM_CHARACTER + 'foobar')).toEqual('foobar');
		expect(strings.stripUTF8BOM('foobar' + strings.UTF8_BOM_CHARACTER)).toEqual('foobar' + strings.UTF8_BOM_CHARACTER);
		expect(strings.stripUTF8BOM('abc')).toEqual('abc');
		expect(strings.stripUTF8BOM('')).toEqual('');
	});

	test('containsUppercaseCharacter', () => {
		[
			[null, false],
			['', false],
			['foo', false],
			['föö', false],
			['ناك', false],
			['מבוססת', false],
			['😀', false],
			['(#@()*&%()@*#&09827340982374}{:">?></\'\\~`', false],

			['Foo', true],
			['FOO', true],
			['FöÖ', true],
			['FöÖ', true],
			['\\Foo', true],
		].forEach(([str, result]) => {
			expect(strings.containsUppercaseCharacter(<string>str)).toEqual(result);
		});
	});

	test('containsUppercaseCharacter (ignoreEscapedChars)', () => {
		[
			['\\Woo', false],
			['f\\S\\S', false],
			['foo', false],

			['Foo', true],
		].forEach(([str, result]) => {
			expect(strings.containsUppercaseCharacter(<string>str, true)).toEqual(result);
		});
	});

	test('uppercaseFirstLetter', () => {
		[
			['', ''],
			['foo', 'Foo'],
			['f', 'F'],
			['123', '123'],
			['.a', '.a'],
		].forEach(([inStr, result]) => {
			expect(strings.uppercaseFirstLetter(inStr)).toEqual(result);
		});
	});

	test('getNLines', () => {
		expect(strings.getNLines('', 5)).toEqual('');
		expect(strings.getNLines('foo', 5)).toEqual('foo');
		expect(strings.getNLines('foo\nbar', 5)).toEqual('foo\nbar');
		expect(strings.getNLines('foo\nbar', 2)).toEqual('foo\nbar');

		expect(strings.getNLines('foo\nbar', 1)).toEqual('foo');
		expect(strings.getNLines('foo\nbar')).toEqual('foo');
		expect(strings.getNLines('foo\nbar\nsomething', 2)).toEqual('foo\nbar');
		expect(strings.getNLines('foo', 0)).toEqual('');
	});

	test('removeAccents', () => {
		expect(strings.removeAccents('joào')).toEqual('joao');
		expect(strings.removeAccents('joáo')).toEqual('joao');
		expect(strings.removeAccents('joâo')).toEqual('joao');
		expect(strings.removeAccents('joäo')).toEqual('joao');
		// assert.equal(strings.removeAccents('joæo'), 'joao'); // not an accent
		expect(strings.removeAccents('joão')).toEqual('joao');
		expect(strings.removeAccents('joåo')).toEqual('joao');
		expect(strings.removeAccents('joåo')).toEqual('joao');
		expect(strings.removeAccents('joāo')).toEqual('joao');

		expect(strings.removeAccents('fôo')).toEqual('foo');
		expect(strings.removeAccents('föo')).toEqual('foo');
		expect(strings.removeAccents('fòo')).toEqual('foo');
		expect(strings.removeAccents('fóo')).toEqual('foo');
		// assert.equal(strings.removeAccents('fœo'), 'foo');
		// assert.equal(strings.removeAccents('føo'), 'foo');
		expect(strings.removeAccents('fōo')).toEqual('foo');
		expect(strings.removeAccents('fõo')).toEqual('foo');

		expect(strings.removeAccents('andrè')).toEqual('andre');
		expect(strings.removeAccents('andré')).toEqual('andre');
		expect(strings.removeAccents('andrê')).toEqual('andre');
		expect(strings.removeAccents('andrë')).toEqual('andre');
		expect(strings.removeAccents('andrē')).toEqual('andre');
		expect(strings.removeAccents('andrė')).toEqual('andre');
		expect(strings.removeAccents('andrę')).toEqual('andre');

		expect(strings.removeAccents('hvîc')).toEqual('hvic');
		expect(strings.removeAccents('hvïc')).toEqual('hvic');
		expect(strings.removeAccents('hvíc')).toEqual('hvic');
		expect(strings.removeAccents('hvīc')).toEqual('hvic');
		expect(strings.removeAccents('hvįc')).toEqual('hvic');
		expect(strings.removeAccents('hvìc')).toEqual('hvic');

		expect(strings.removeAccents('ûdo')).toEqual('udo');
		expect(strings.removeAccents('üdo')).toEqual('udo');
		expect(strings.removeAccents('ùdo')).toEqual('udo');
		expect(strings.removeAccents('údo')).toEqual('udo');
		expect(strings.removeAccents('ūdo')).toEqual('udo');

		expect(strings.removeAccents('heÿ')).toEqual('hey');

		// assert.equal(strings.removeAccents('gruß'), 'grus');
		expect(strings.removeAccents('gruś')).toEqual('grus');
		expect(strings.removeAccents('gruš')).toEqual('grus');

		expect(strings.removeAccents('çool')).toEqual('cool');
		expect(strings.removeAccents('ćool')).toEqual('cool');
		expect(strings.removeAccents('čool')).toEqual('cool');

		expect(strings.removeAccents('ñice')).toEqual('nice');
		expect(strings.removeAccents('ńice')).toEqual('nice');
	});
});
