// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/path.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// NOTE: VSCode's copy of nodejs path library to be usable in common (non-node) namespace
// Copied from: https://github.com/nodejs/node/tree/43dd49c9782848c25e5b03448c8a0f923f13c158

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

import * as path from '../src/path';
import { Path } from '../src/path';
import { isWindows } from '../src/platform';

describe('Paths (Node Implementation)', () => {
  test('join', () => {
    const failures = [] as string[];
    const backslashRE = /\\/g;

    const joinTests: any = [
      [
        [path.posix.join, path.win32.join],
        // arguments                     result
        [
          [['.', 'x/b', '..', '/b/c.js'], 'x/b/c.js'],
          [[], '.'],
          [['/.', 'x/b', '..', '/b/c.js'], '/x/b/c.js'],
          [['/foo', '../../../bar'], '/bar'],
          [['foo', '../../../bar'], '../../bar'],
          [['foo/', '../../../bar'], '../../bar'],
          [['foo/x', '../../../bar'], '../bar'],
          [['foo/x', './bar'], 'foo/x/bar'],
          [['foo/x/', './bar'], 'foo/x/bar'],
          [['foo/x/', '.', 'bar'], 'foo/x/bar'],
          [['./'], './'],
          [['.', './'], './'],
          [['.', '.', '.'], '.'],
          [['.', './', '.'], '.'],
          [['.', '/./', '.'], '.'],
          [['.', '/////./', '.'], '.'],
          [['.'], '.'],
          [['', '.'], '.'],
          [['', 'foo'], 'foo'],
          [['foo', '/bar'], 'foo/bar'],
          [['', '/foo'], '/foo'],
          [['', '', '/foo'], '/foo'],
          [['', '', 'foo'], 'foo'],
          [['foo', ''], 'foo'],
          [['foo/', ''], 'foo/'],
          [['foo', '', '/bar'], 'foo/bar'],
          [['./', '..', '/foo'], '../foo'],
          [['./', '..', '..', '/foo'], '../../foo'],
          [['.', '..', '..', '/foo'], '../../foo'],
          [['', '..', '..', '/foo'], '../../foo'],
          [['/'], '/'],
          [['/', '.'], '/'],
          [['/', '..'], '/'],
          [['/', '..', '..'], '/'],
          [[''], '.'],
          [['', ''], '.'],
          [[' /foo'], ' /foo'],
          [[' ', 'foo'], ' /foo'],
          [[' ', '.'], ' '],
          [[' ', '/'], ' /'],
          [[' ', ''], ' '],
          [['/', 'foo'], '/foo'],
          [['/', '/foo'], '/foo'],
          [['/', '//foo'], '/foo'],
          [['/', '', '/foo'], '/foo'],
          [['', '/', 'foo'], '/foo'],
          [['', '/', '/foo'], '/foo'],
        ],
      ],
    ];

    // Windows-specific join tests
    joinTests.push([
      path.win32.join,
      joinTests[0][1].slice(0).concat([
        // arguments                     result
        // UNC path expected
        [['//foo/bar'], '\\\\foo\\bar\\'],
        [['\\/foo/bar'], '\\\\foo\\bar\\'],
        [['\\\\foo/bar'], '\\\\foo\\bar\\'],
        // UNC path expected - server and share separate
        [['//foo', 'bar'], '\\\\foo\\bar\\'],
        [['//foo/', 'bar'], '\\\\foo\\bar\\'],
        [['//foo', '/bar'], '\\\\foo\\bar\\'],
        // UNC path expected - questionable
        [['//foo', '', 'bar'], '\\\\foo\\bar\\'],
        [['//foo/', '', 'bar'], '\\\\foo\\bar\\'],
        [['//foo/', '', '/bar'], '\\\\foo\\bar\\'],
        // UNC path expected - even more questionable
        [['', '//foo', 'bar'], '\\\\foo\\bar\\'],
        [['', '//foo/', 'bar'], '\\\\foo\\bar\\'],
        [['', '//foo/', '/bar'], '\\\\foo\\bar\\'],
        // No UNC path expected (no double slash in first component)
        [['\\', 'foo/bar'], '\\foo\\bar'],
        [['\\', '/foo/bar'], '\\foo\\bar'],
        [['', '/', '/foo/bar'], '\\foo\\bar'],
        // No UNC path expected (no non-slashes in first component -
        // questionable)
        [['//', 'foo/bar'], '\\foo\\bar'],
        [['//', '/foo/bar'], '\\foo\\bar'],
        [['\\\\', '/', '/foo/bar'], '\\foo\\bar'],
        [['//'], '\\'],
        // No UNC path expected (share name missing - questionable).
        [['//foo'], '\\foo'],
        [['//foo/'], '\\foo\\'],
        [['//foo', '/'], '\\foo\\'],
        [['//foo', '', '/'], '\\foo\\'],
        // No UNC path expected (too many leading slashes - questionable)
        [['///foo/bar'], '\\foo\\bar'],
        [['////foo', 'bar'], '\\foo\\bar'],
        [['\\\\\\/foo/bar'], '\\foo\\bar'],
        // Drive-relative vs drive-absolute paths. This merely describes the
        // status quo, rather than being obviously right
        [['c:'], 'c:.'],
        [['c:.'], 'c:.'],
        [['c:', ''], 'c:.'],
        [['', 'c:'], 'c:.'],
        [['c:.', '/'], 'c:.\\'],
        [['c:.', 'file'], 'c:file'],
        [['c:', '/'], 'c:\\'],
        [['c:', 'file'], 'c:\\file'],
      ]),
    ]);
    joinTests.forEach((test: any[]) => {
      if (!Array.isArray(test[0])) {
        test[0] = [test[0]];
      }
      test[0].forEach((join: any) => {
        test[1].forEach((test: any) => {
          // eslint-disable-next-line prefer-spread
          const actual = join.apply(null, test[0]);
          const expected = test[1];
          // For non-Windows specific tests with the Windows join(), we need to try
          // replacing the slashes since the non-Windows specific tests' `expected`
          // use forward slashes
          let actualAlt;
          let os;
          if (join === path.win32.join) {
            actualAlt = actual.replace(backslashRE, '/');
            os = 'win32';
          } else {
            os = 'posix';
          }
          const message = `path.${os}.join(${test[0].map(JSON.stringify).join(',')})\n  expect=${JSON.stringify(
            expected,
          )}\n  actual=${JSON.stringify(actual)}`;
          if (actual !== expected && actualAlt !== expected) {
            failures.push(`\n${message}`);
          }
        });
      });
    });
    expect(failures.length).toBe(0);
  });

  test('dirname', () => {
    expect(path.dirname(path.normalize(__filename)).substr(-11)).toBe(isWindows ? 'n/__tests__' : 'n/__tests__');

    expect(path.posix.dirname('/a/b/')).toBe('/a');
    expect(path.posix.dirname('/a/b')).toBe('/a');
    expect(path.posix.dirname('/a')).toBe('/');
    expect(path.posix.dirname('')).toBe('.');
    expect(path.posix.dirname('/')).toBe('/');
    expect(path.posix.dirname('////')).toBe('/');
    expect(path.posix.dirname('//a')).toBe('//');
    expect(path.posix.dirname('foo')).toBe('.');

    expect(path.win32.dirname('c:\\')).toBe('c:\\');
    expect(path.win32.dirname('c:\\foo')).toBe('c:\\');
    expect(path.win32.dirname('c:\\foo\\')).toBe('c:\\');
    expect(path.win32.dirname('c:\\foo\\bar')).toBe('c:\\foo');
    expect(path.win32.dirname('c:\\foo\\bar\\')).toBe('c:\\foo');
    expect(path.win32.dirname('c:\\foo\\bar\\baz')).toBe('c:\\foo\\bar');
    expect(path.win32.dirname('\\')).toBe('\\');
    expect(path.win32.dirname('\\foo')).toBe('\\');
    expect(path.win32.dirname('\\foo\\')).toBe('\\');
    expect(path.win32.dirname('\\foo\\bar')).toBe('\\foo');
    expect(path.win32.dirname('\\foo\\bar\\')).toBe('\\foo');
    expect(path.win32.dirname('\\foo\\bar\\baz')).toBe('\\foo\\bar');
    expect(path.win32.dirname('c:')).toBe('c:');
    expect(path.win32.dirname('c:foo')).toBe('c:');
    expect(path.win32.dirname('c:foo\\')).toBe('c:');
    expect(path.win32.dirname('c:foo\\bar')).toBe('c:foo');
    expect(path.win32.dirname('c:foo\\bar\\')).toBe('c:foo');
    expect(path.win32.dirname('c:foo\\bar\\baz')).toBe('c:foo\\bar');
    expect(path.win32.dirname('file:stream')).toBe('.');
    expect(path.win32.dirname('dir\\file:stream')).toBe('dir');
    expect(path.win32.dirname('\\\\unc\\share')).toBe('\\\\unc\\share');
    expect(path.win32.dirname('\\\\unc\\share\\foo')).toBe('\\\\unc\\share\\');
    expect(path.win32.dirname('\\\\unc\\share\\foo\\')).toBe('\\\\unc\\share\\');
    expect(path.win32.dirname('\\\\unc\\share\\foo\\bar')).toBe('\\\\unc\\share\\foo');
    expect(path.win32.dirname('\\\\unc\\share\\foo\\bar\\')).toBe('\\\\unc\\share\\foo');
    expect(path.win32.dirname('\\\\unc\\share\\foo\\bar\\baz')).toBe('\\\\unc\\share\\foo\\bar');
    expect(path.win32.dirname('/a/b/')).toBe('/a');
    expect(path.win32.dirname('/a/b')).toBe('/a');
    expect(path.win32.dirname('/a')).toBe('/');
    expect(path.win32.dirname('')).toBe('.');
    expect(path.win32.dirname('/')).toBe('/');
    expect(path.win32.dirname('////')).toBe('/');
    expect(path.win32.dirname('foo')).toBe('.');

    // Tests from VSCode

    function assertDirname(p: string, expected: string, win = false) {
      const actual = win ? path.win32.dirname(p) : path.posix.dirname(p);

      if (actual !== expected) {
        expect(false).toBe(true);
      }
    }

    assertDirname('foo/bar', 'foo');
    assertDirname('foo\\bar', 'foo', true);
    assertDirname('/foo/bar', '/foo');
    assertDirname('\\foo\\bar', '\\foo', true);
    assertDirname('/foo', '/');
    assertDirname('\\foo', '\\', true);
    assertDirname('/', '/');
    assertDirname('\\', '\\', true);
    assertDirname('foo', '.');
    assertDirname('f', '.');
    assertDirname('f/', '.');
    assertDirname('/folder/', '/');
    assertDirname('c:\\some\\file.txt', 'c:\\some', true);
    assertDirname('c:\\some', 'c:\\', true);
    assertDirname('c:\\', 'c:\\', true);
    assertDirname('c:', 'c:', true);
    assertDirname('\\\\server\\share\\some\\path', '\\\\server\\share\\some', true);
    assertDirname('\\\\server\\share\\some', '\\\\server\\share\\', true);
    assertDirname('\\\\server\\share\\', '\\\\server\\share\\', true);
  });

  test('extname', () => {
    const failures = [] as string[];
    const slashRE = /\//g;

    [
      [__filename, '.ts'],
      ['', ''],
      ['/path/to/file', ''],
      ['/path/to/file.ext', '.ext'],
      ['/path.to/file.ext', '.ext'],
      ['/path.to/file', ''],
      ['/path.to/.file', ''],
      ['/path.to/.file.ext', '.ext'],
      ['/path/to/f.ext', '.ext'],
      ['/path/to/..ext', '.ext'],
      ['/path/to/..', ''],
      ['file', ''],
      ['file.ext', '.ext'],
      ['.file', ''],
      ['.file.ext', '.ext'],
      ['/file', ''],
      ['/file.ext', '.ext'],
      ['/.file', ''],
      ['/.file.ext', '.ext'],
      ['.path/file.ext', '.ext'],
      ['file.ext.ext', '.ext'],
      ['file.', '.'],
      ['.', ''],
      ['./', ''],
      ['.file.ext', '.ext'],
      ['.file', ''],
      ['.file.', '.'],
      ['.file..', '.'],
      ['..', ''],
      ['../', ''],
      ['..file.ext', '.ext'],
      ['..file', '.file'],
      ['..file.', '.'],
      ['..file..', '.'],
      ['...', '.'],
      ['...ext', '.ext'],
      ['....', '.'],
      ['file.ext/', '.ext'],
      ['file.ext//', '.ext'],
      ['file/', ''],
      ['file//', ''],
      ['file./', '.'],
      ['file.//', '.'],
    ].forEach((test) => {
      const expected = test[1];
      [path.posix.extname, path.win32.extname].forEach((extname) => {
        let input = test[0];
        let os;
        if (extname === path.win32.extname) {
          input = input.replace(slashRE, '\\');
          os = 'win32';
        } else {
          os = 'posix';
        }
        const actual = extname(input);
        const message = `path.${os}.extname(${JSON.stringify(input)})\n  expect=${JSON.stringify(
          expected,
        )}\n  actual=${JSON.stringify(actual)}`;
        if (actual !== expected) {
          failures.push(`\n${message}`);
        }
      });
      {
        const input = `C:${test[0].replace(slashRE, '\\')}`;
        const actual = path.win32.extname(input);
        const message = `path.win32.extname(${JSON.stringify(input)})\n  expect=${JSON.stringify(
          expected,
        )}\n  actual=${JSON.stringify(actual)}`;
        if (actual !== expected) {
          failures.push(`\n${message}`);
        }
      }
    });
    expect(failures.length).toBe(0);

    // On Windows, backslash is a path separator.
    expect(path.win32.extname('.\\')).toBe('');
    expect(path.win32.extname('..\\')).toBe('');
    expect(path.win32.extname('file.ext\\')).toBe('.ext');
    expect(path.win32.extname('file.ext\\\\')).toBe('.ext');
    expect(path.win32.extname('file\\')).toBe('');
    expect(path.win32.extname('file\\\\')).toBe('');
    expect(path.win32.extname('file.\\')).toBe('.');
    expect(path.win32.extname('file.\\\\')).toBe('.');

    // On *nix, backslash is a valid name component like any other character.
    expect(path.posix.extname('.\\')).toBe('');
    expect(path.posix.extname('..\\')).toBe('.\\');
    expect(path.posix.extname('file.ext\\')).toBe('.ext\\');
    expect(path.posix.extname('file.ext\\\\')).toBe('.ext\\\\');
    expect(path.posix.extname('file\\')).toBe('');
    expect(path.posix.extname('file\\\\')).toBe('');
    expect(path.posix.extname('file.\\')).toBe('.\\');
    expect(path.posix.extname('file.\\\\')).toBe('.\\\\');

    // Tests from VSCode
    expect(path.extname('far.boo')).toEqual('.boo');
    expect(path.extname('far.b')).toEqual('.b');
    expect(path.extname('far.')).toEqual('.');
    expect(path.extname('far.boo/boo.far')).toEqual('.far');
    expect(path.extname('far.boo/boo')).toEqual('');
  });

  test('resolve', () => {
    const failures = [] as string[];
    const slashRE = /\//g;
    const backslashRE = /\\/g;

    const resolveTests = [
      [
        path.win32.resolve,
        // arguments                               result
        [
          [['c:/blah\\blah', 'd:/games', 'c:../a'], 'c:\\blah\\a'],
          [['c:/ignore', 'd:\\a/b\\c/d', '\\e.exe'], 'd:\\e.exe'],
          [['c:/ignore', 'c:/some/file'], 'c:\\some\\file'],
          [['d:/ignore', 'd:some/dir//'], 'd:\\ignore\\some\\dir'],
          [['.'], process.cwd()],
          [['//server/share', '..', 'relative\\'], '\\\\server\\share\\relative'],
          [['c:/', '//'], 'c:\\'],
          [['c:/', '//dir'], 'c:\\dir'],
          [['c:/', '//server/share'], '\\\\server\\share\\'],
          [['c:/', '//server//share'], '\\\\server\\share\\'],
          [['c:/', '///some//dir'], 'c:\\some\\dir'],
          [['C:\\foo\\tmp.3\\', '..\\tmp.3\\cycles\\root.js'], 'C:\\foo\\tmp.3\\cycles\\root.js'],
        ],
      ],
      [
        path.posix.resolve,
        // arguments                    result
        [
          [['/var/lib', '../', 'file/'], '/var/file'],
          [['/var/lib', '/../', 'file/'], '/file'],
          [['a/b/c/', '../../..'], process.cwd()],
          [['.'], process.cwd()],
          [['/some/dir', '.', '/absolute/'], '/absolute'],
          [['/foo/tmp.3/', '../tmp.3/cycles/root.js'], '/foo/tmp.3/cycles/root.js'],
        ],
      ],
    ];
    resolveTests.forEach((test) => {
      const resolve = test[0];
      // @ts-ignore
      test[1].forEach((test) => {
        // @ts-ignore
        // eslint-disable-next-line prefer-spread
        const actual = resolve.apply(null, test[0]);
        let actualAlt;
        const os = resolve === path.win32.resolve ? 'win32' : 'posix';
        if (resolve === path.win32.resolve && !isWindows) {
          actualAlt = actual.replace(backslashRE, '/');
        } else if (resolve !== path.win32.resolve && isWindows) {
          actualAlt = actual.replace(slashRE, '\\');
        }

        const expected = test[1];
        const message = `path.${os}.resolve(${test[0].map(JSON.stringify).join(',')})\n  expect=${JSON.stringify(
          expected,
        )}\n  actual=${JSON.stringify(actual)}`;
        if (actual !== expected && actualAlt !== expected) {
          failures.push(`\n${message}`);
        }
      });
    });
    expect(failures.length).toBe(0);

    // if (isWindows) {
    // 	// Test resolving the current Windows drive letter from a spawned process.
    // 	// See https://github.com/nodejs/node/issues/7215
    // 	const currentDriveLetter = path.parse(process.cwd()).root.substring(0, 2);
    // 	const resolveFixture = fixtures.path('path-resolve.js');
    // 	const spawnResult = child.spawnSync(
    // 		process.argv[0], [resolveFixture, currentDriveLetter]);
    // 	const resolvedPath = spawnResult.stdout.toString().trim();
    // 	assert.strictEqual(resolvedPath.toLowerCase(), process.cwd().toLowerCase());
    // }
  });

  test('basename', () => {
    expect(path.basename(__filename)).toBe('path.test.ts');
    expect(path.basename(__filename, '.ts')).toBe('path.test');
    expect(path.basename('.js', '.js')).toBe('');
    expect(path.basename('')).toBe('');
    expect(path.basename('/dir/basename.ext')).toBe('basename.ext');
    expect(path.basename('/basename.ext')).toBe('basename.ext');
    expect(path.basename('basename.ext')).toBe('basename.ext');
    expect(path.basename('basename.ext/')).toBe('basename.ext');
    expect(path.basename('basename.ext//')).toBe('basename.ext');
    expect(path.basename('aaa/bbb', '/bbb')).toBe('bbb');
    expect(path.basename('aaa/bbb', 'a/bbb')).toBe('bbb');
    expect(path.basename('aaa/bbb', 'bbb')).toBe('bbb');
    expect(path.basename('aaa/bbb//', 'bbb')).toBe('bbb');
    expect(path.basename('aaa/bbb', 'bb')).toBe('b');
    expect(path.basename('aaa/bbb', 'b')).toBe('bb');
    expect(path.basename('/aaa/bbb', '/bbb')).toBe('bbb');
    expect(path.basename('/aaa/bbb', 'a/bbb')).toBe('bbb');
    expect(path.basename('/aaa/bbb', 'bbb')).toBe('bbb');
    expect(path.basename('/aaa/bbb//', 'bbb')).toBe('bbb');
    expect(path.basename('/aaa/bbb', 'bb')).toBe('b');
    expect(path.basename('/aaa/bbb', 'b')).toBe('bb');
    expect(path.basename('/aaa/bbb')).toBe('bbb');
    expect(path.basename('/aaa/')).toBe('aaa');
    expect(path.basename('/aaa/b')).toBe('b');
    expect(path.basename('/a/b')).toBe('b');
    expect(path.basename('//a')).toBe('a');
    expect(path.basename('a', 'a')).toBe('');

    // On Windows a backslash acts as a path separator.
    expect(path.win32.basename('\\dir\\basename.ext')).toBe('basename.ext');
    expect(path.win32.basename('\\basename.ext')).toBe('basename.ext');
    expect(path.win32.basename('basename.ext')).toBe('basename.ext');
    expect(path.win32.basename('basename.ext\\')).toBe('basename.ext');
    expect(path.win32.basename('basename.ext\\\\')).toBe('basename.ext');
    expect(path.win32.basename('foo')).toBe('foo');
    expect(path.win32.basename('aaa\\bbb', '\\bbb')).toBe('bbb');
    expect(path.win32.basename('aaa\\bbb', 'a\\bbb')).toBe('bbb');
    expect(path.win32.basename('aaa\\bbb', 'bbb')).toBe('bbb');
    expect(path.win32.basename('aaa\\bbb\\\\\\\\', 'bbb')).toBe('bbb');
    expect(path.win32.basename('aaa\\bbb', 'bb')).toBe('b');
    expect(path.win32.basename('aaa\\bbb', 'b')).toBe('bb');
    expect(path.win32.basename('C:')).toBe('');
    expect(path.win32.basename('C:.')).toBe('.');
    expect(path.win32.basename('C:\\')).toBe('');
    expect(path.win32.basename('C:\\dir\\base.ext')).toBe('base.ext');
    expect(path.win32.basename('C:\\basename.ext')).toBe('basename.ext');
    expect(path.win32.basename('C:basename.ext')).toBe('basename.ext');
    expect(path.win32.basename('C:basename.ext\\')).toBe('basename.ext');
    expect(path.win32.basename('C:basename.ext\\\\')).toBe('basename.ext');
    expect(path.win32.basename('C:foo')).toBe('foo');
    expect(path.win32.basename('file:stream')).toBe('file:stream');
    expect(path.win32.basename('a', 'a')).toBe('');

    // On unix a backslash is just treated as any other character.
    expect(path.posix.basename('\\dir\\basename.ext')).toBe('\\dir\\basename.ext');
    expect(path.posix.basename('\\basename.ext')).toBe('\\basename.ext');
    expect(path.posix.basename('basename.ext')).toBe('basename.ext');
    expect(path.posix.basename('basename.ext\\')).toBe('basename.ext\\');
    expect(path.posix.basename('basename.ext\\\\')).toBe('basename.ext\\\\');
    expect(path.posix.basename('foo')).toBe('foo');

    // POSIX filenames may include control characters
    // c.f. http://www.dwheeler.com/essays/fixing-unix-linux-filenames.html
    const controlCharFilename = `Icon${String.fromCharCode(13)}`;
    expect(path.posix.basename(`/a/b/${controlCharFilename}`)).toBe(controlCharFilename);

    // Tests from VSCode
    expect(path.basename('foo/bar')).toEqual('bar');
    expect(path.posix.basename('foo\\bar')).toEqual('foo\\bar');
    expect(path.win32.basename('foo\\bar')).toEqual('bar');
    expect(path.basename('/foo/bar')).toEqual('bar');
    expect(path.posix.basename('\\foo\\bar')).toEqual('\\foo\\bar');
    expect(path.win32.basename('\\foo\\bar')).toEqual('bar');
    expect(path.basename('./bar')).toEqual('bar');
    expect(path.posix.basename('.\\bar')).toEqual('.\\bar');
    expect(path.win32.basename('.\\bar')).toEqual('bar');
    expect(path.basename('/bar')).toEqual('bar');
    expect(path.posix.basename('\\bar')).toEqual('\\bar');
    expect(path.win32.basename('\\bar')).toEqual('bar');
    expect(path.basename('bar/')).toEqual('bar');
    expect(path.posix.basename('bar\\')).toEqual('bar\\');
    expect(path.win32.basename('bar\\')).toEqual('bar');
    expect(path.basename('bar')).toEqual('bar');
    expect(path.basename('////////')).toEqual('');
    expect(path.posix.basename('\\\\\\\\')).toEqual('\\\\\\\\');
    expect(path.win32.basename('\\\\\\\\')).toEqual('');
  });

  test('relative', () => {
    const failures = [] as string[];

    const relativeTests = [
      [
        path.win32.relative,
        // arguments                     result
        [
          ['c:/blah\\blah', 'd:/games', 'd:\\games'],
          ['c:/aaaa/bbbb', 'c:/aaaa', '..'],
          ['c:/aaaa/bbbb', 'c:/cccc', '..\\..\\cccc'],
          ['c:/aaaa/bbbb', 'c:/aaaa/bbbb', ''],
          ['c:/aaaa/bbbb', 'c:/aaaa/cccc', '..\\cccc'],
          ['c:/aaaa/', 'c:/aaaa/cccc', 'cccc'],
          ['c:/', 'c:\\aaaa\\bbbb', 'aaaa\\bbbb'],
          ['c:/aaaa/bbbb', 'd:\\', 'd:\\'],
          ['c:/AaAa/bbbb', 'c:/aaaa/bbbb', ''],
          ['c:/aaaaa/', 'c:/aaaa/cccc', '..\\aaaa\\cccc'],
          ['C:\\foo\\bar\\baz\\quux', 'C:\\', '..\\..\\..\\..'],
          ['C:\\foo\\test', 'C:\\foo\\test\\bar\\package.json', 'bar\\package.json'],
          ['C:\\foo\\bar\\baz-quux', 'C:\\foo\\bar\\baz', '..\\baz'],
          ['C:\\foo\\bar\\baz', 'C:\\foo\\bar\\baz-quux', '..\\baz-quux'],
          ['\\\\foo\\bar', '\\\\foo\\bar\\baz', 'baz'],
          ['\\\\foo\\bar\\baz', '\\\\foo\\bar', '..'],
          ['\\\\foo\\bar\\baz-quux', '\\\\foo\\bar\\baz', '..\\baz'],
          ['\\\\foo\\bar\\baz', '\\\\foo\\bar\\baz-quux', '..\\baz-quux'],
          ['C:\\baz-quux', 'C:\\baz', '..\\baz'],
          ['C:\\baz', 'C:\\baz-quux', '..\\baz-quux'],
          ['\\\\foo\\baz-quux', '\\\\foo\\baz', '..\\baz'],
          ['\\\\foo\\baz', '\\\\foo\\baz-quux', '..\\baz-quux'],
          ['C:\\baz', '\\\\foo\\bar\\baz', '\\\\foo\\bar\\baz'],
          ['\\\\foo\\bar\\baz', 'C:\\baz', 'C:\\baz'],
        ],
      ],
      [
        path.posix.relative,
        // arguments          result
        [
          ['/var/lib', '/var', '..'],
          ['/var/lib', '/bin', '../../bin'],
          ['/var/lib', '/var/lib', ''],
          ['/var/lib', '/var/apache', '../apache'],
          ['/var/', '/var/lib', 'lib'],
          ['/', '/var/lib', 'var/lib'],
          ['/foo/test', '/foo/test/bar/package.json', 'bar/package.json'],
          ['/Users/a/web/b/test/mails', '/Users/a/web/b', '../..'],
          ['/foo/bar/baz-quux', '/foo/bar/baz', '../baz'],
          ['/foo/bar/baz', '/foo/bar/baz-quux', '../baz-quux'],
          ['/baz-quux', '/baz', '../baz'],
          ['/baz', '/baz-quux', '../baz-quux'],
        ],
      ],
    ];
    relativeTests.forEach((test) => {
      const relative = test[0];
      // @ts-ignore
      test[1].forEach((test) => {
        // @ts-ignore
        const actual = relative(test[0], test[1]);
        const expected = test[2];
        const os = relative === path.win32.relative ? 'win32' : 'posix';
        const message = `path.${os}.relative(${test
          .slice(0, 2)
          .map(JSON.stringify)
          .join(',')})\n  expect=${JSON.stringify(expected)}\n  actual=${JSON.stringify(actual)}`;
        if (actual !== expected) {
          failures.push(`\n${message}`);
        }
      });
    });
    expect(failures.length).toBe(0);
  });

  test('normalize', () => {
    expect(path.win32.normalize('./fixtures///b/../b/c.js')).toBe('fixtures\\b\\c.js');
    expect(path.win32.normalize('/foo/../../../bar')).toBe('\\bar');
    expect(path.win32.normalize('a//b//../b')).toBe('a\\b');
    expect(path.win32.normalize('a//b//./c')).toBe('a\\b\\c');
    expect(path.win32.normalize('a//b//.')).toBe('a\\b');
    expect(path.win32.normalize('//server/share/dir/file.ext')).toBe('\\\\server\\share\\dir\\file.ext');
    expect(path.win32.normalize('/a/b/c/../../../x/y/z')).toBe('\\x\\y\\z');
    expect(path.win32.normalize('C:')).toBe('C:.');
    expect(path.win32.normalize('C:..\\abc')).toBe('C:..\\abc');
    expect(path.win32.normalize('C:..\\..\\abc\\..\\def')).toBe('C:..\\..\\def');
    expect(path.win32.normalize('C:\\.')).toBe('C:\\');
    expect(path.win32.normalize('file:stream')).toBe('file:stream');
    expect(path.win32.normalize('bar\\foo..\\..\\')).toBe('bar\\');
    expect(path.win32.normalize('bar\\foo..\\..')).toBe('bar');
    expect(path.win32.normalize('bar\\foo..\\..\\baz')).toBe('bar\\baz');
    expect(path.win32.normalize('bar\\foo..\\')).toBe('bar\\foo..\\');
    expect(path.win32.normalize('bar\\foo..')).toBe('bar\\foo..');
    expect(path.win32.normalize('..\\foo..\\..\\..\\bar')).toBe('..\\..\\bar');
    expect(path.win32.normalize('..\\...\\..\\.\\...\\..\\..\\bar')).toBe('..\\..\\bar');
    expect(path.win32.normalize('../../../foo/../../../bar')).toBe('..\\..\\..\\..\\..\\bar');
    expect(path.win32.normalize('../../../foo/../../../bar/../../')).toBe('..\\..\\..\\..\\..\\..\\');
    expect(path.win32.normalize('../foobar/barfoo/foo/../../../bar/../../')).toBe('..\\..\\');
    expect(path.win32.normalize('../.../../foobar/../../../bar/../../baz')).toBe('..\\..\\..\\..\\baz');
    expect(path.win32.normalize('foo/bar\\baz')).toBe('foo\\bar\\baz');

    expect(path.posix.normalize('./fixtures///b/../b/c.js')).toBe('fixtures/b/c.js');
    expect(path.posix.normalize('/foo/../../../bar')).toBe('/bar');
    expect(path.posix.normalize('a//b//../b')).toBe('a/b');
    expect(path.posix.normalize('a//b//./c')).toBe('a/b/c');
    expect(path.posix.normalize('a//b//.')).toBe('a/b');
    expect(path.posix.normalize('/a/b/c/../../../x/y/z')).toBe('/x/y/z');
    expect(path.posix.normalize('///..//./foo/.//bar')).toBe('/foo/bar');
    expect(path.posix.normalize('bar/foo../../')).toBe('bar/');
    expect(path.posix.normalize('bar/foo../..')).toBe('bar');
    expect(path.posix.normalize('bar/foo../../baz')).toBe('bar/baz');
    expect(path.posix.normalize('bar/foo../')).toBe('bar/foo../');
    expect(path.posix.normalize('bar/foo..')).toBe('bar/foo..');
    expect(path.posix.normalize('../foo../../../bar')).toBe('../../bar');
    expect(path.posix.normalize('../.../.././.../../../bar')).toBe('../../bar');
    expect(path.posix.normalize('../../../foo/../../../bar')).toBe('../../../../../bar');
    expect(path.posix.normalize('../../../foo/../../../bar/../../')).toBe('../../../../../../');
    expect(path.posix.normalize('../foobar/barfoo/foo/../../../bar/../../')).toBe('../../');
    expect(path.posix.normalize('../.../../foobar/../../../bar/../../baz')).toBe('../../../../baz');
    expect(path.posix.normalize('foo/bar\\baz')).toBe('foo/bar\\baz');
  });

  test('isAbsolute', () => {
    expect(path.win32.isAbsolute('/')).toBe(true);
    expect(path.win32.isAbsolute('//')).toBe(true);
    expect(path.win32.isAbsolute('//server')).toBe(true);
    expect(path.win32.isAbsolute('//server/file')).toBe(true);
    expect(path.win32.isAbsolute('\\\\server\\file')).toBe(true);
    expect(path.win32.isAbsolute('\\\\server')).toBe(true);
    expect(path.win32.isAbsolute('\\\\')).toBe(true);
    expect(path.win32.isAbsolute('c')).toBe(false);
    expect(path.win32.isAbsolute('c:')).toBe(false);
    expect(path.win32.isAbsolute('c:\\')).toBe(true);
    expect(path.win32.isAbsolute('c:/')).toBe(true);
    expect(path.win32.isAbsolute('c://')).toBe(true);
    expect(path.win32.isAbsolute('C:/Users/')).toBe(true);
    expect(path.win32.isAbsolute('C:\\Users\\')).toBe(true);
    expect(path.win32.isAbsolute('C:cwd/another')).toBe(false);
    expect(path.win32.isAbsolute('C:cwd\\another')).toBe(false);
    expect(path.win32.isAbsolute('directory/directory')).toBe(false);
    expect(path.win32.isAbsolute('directory\\directory')).toBe(false);

    expect(path.posix.isAbsolute('/home/foo')).toBe(true);
    expect(path.posix.isAbsolute('/home/foo/..')).toBe(true);
    expect(path.posix.isAbsolute('bar/')).toBe(false);
    expect(path.posix.isAbsolute('./baz')).toBe(false);

    // Tests from VSCode:

    // Absolute Paths
    [
      'C:/',
      'C:\\',
      'C:/foo',
      'C:\\foo',
      'z:/foo/bar.txt',
      'z:\\foo\\bar.txt',

      '\\\\localhost\\c$\\foo',

      '/',
      '/foo',
    ].forEach((absolutePath) => {
      expect(path.win32.isAbsolute(absolutePath)).toBeTruthy();
    });

    ['/', '/foo', '/foo/bar.txt'].forEach((absolutePath) => {
      expect(path.posix.isAbsolute(absolutePath)).toBeTruthy();
    });

    // Relative Paths
    ['', 'foo', 'foo/bar', './foo', 'http://foo.com/bar'].forEach((nonAbsolutePath) => {
      expect(!path.win32.isAbsolute(nonAbsolutePath)).toBeTruthy();
    });

    ['', 'foo', 'foo/bar', './foo', 'http://foo.com/bar', 'z:/foo/bar.txt'].forEach((nonAbsolutePath) => {
      expect(!path.posix.isAbsolute(nonAbsolutePath)).toBeTruthy();
    });
  });

  test('path', () => {
    // path.sep tests
    // windows
    expect(path.win32.sep).toBe('\\');
    // posix
    expect(path.posix.sep).toBe('/');

    // path.delimiter tests
    // windows
    expect(path.win32.delimiter).toBe(';');
    // posix
    expect(path.posix.delimiter).toBe(':');
  });
});

describe('Path.join', () => {
  // Windows
  test('join common path in Windows', () => {
    const path = new Path('/c:/a/b');
    expect(path.join('c', 'd').toString()).toBe('/c:/a/b/c/d');
    expect(path.join('e/f').toString()).toBe('/c:/a/b/e/f');
  });

  test('join relative path in Windows', () => {
    const path = new Path('/c:/a/b');
    expect(path.join('./').toString()).toBe('/c:/a/b/');
    expect(path.join('./././', '././').toString()).toBe('/c:/a/b/');
    expect(path.join('../', './b/', './', '../', '../', './a').toString()).toBe('/c:/a');
  });

  // POSIX

  test('join common path in POSIX', () => {
    const path = new Path('/a/b/');
    expect(path.join('c', 'd').toString()).toBe('/a/b/c/d');
    expect(path.join('e/f').toString()).toBe('/a/b/e/f');
    expect(path.join('l/m', '/n/', 'o/', 'p').toString()).toBe('/a/b/l/m/n/o/p');
  });

  test('join relative path in POSIX', () => {
    const path = new Path('/a/b');
    expect(path.join('./').toString()).toBe('/a/b/');
    expect(path.join('./././', '././').toString()).toBe('/a/b/');
    expect(path.join('../', './b/', './', '../', '../', './a').toString()).toBe('/a');
  });
});
