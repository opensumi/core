// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/glob.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isWindows } from '../../src/platform';
import * as glob from '../../src/utils/glob';
import * as path from '../../src/utils/paths';

describe('Glob', () => {
  // it('perf', () => {

  // 	let patterns = [
  // 		'{**/*.cs,**/*.json,**/*.csproj,**/*.sln}',
  // 		'{**/*.cs,**/*.csproj,**/*.sln}',
  // 		'{**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.es6,**/*.mjs,**/*.cjs}',
  // 		'**/*.go',
  // 		'{**/*.ps,**/*.ps1}',
  // 		'{**/*.c,**/*.cpp,**/*.h}',
  // 		'{**/*.fsx,**/*.fsi,**/*.fs,**/*.ml,**/*.mli}',
  // 		'{**/*.js,**/*.jsx,**/*.es6,**/*.mjs,**/*.cjs}',
  // 		'{**/*.ts,**/*.tsx}',
  // 		'{**/*.php}',
  // 		'{**/*.php}',
  // 		'{**/*.php}',
  // 		'{**/*.php}',
  // 		'{**/*.py}',
  // 		'{**/*.py}',
  // 		'{**/*.py}',
  // 		'{**/*.rs,**/*.rslib}',
  // 		'{**/*.cpp,**/*.cc,**/*.h}',
  // 		'{**/*.md}',
  // 		'{**/*.md}',
  // 		'{**/*.md}'
  // 	];

  // 	let paths = [
  // 		'/DNXConsoleApp/Program.cs',
  // 		'C:\\DNXConsoleApp\\foo\\Program.cs',
  // 		'test/qunit',
  // 		'test/test.txt',
  // 		'test/node_modules',
  // 		'.hidden.txt',
  // 		'/node_module/test/foo.js'
  // 	];

  // 	let results = 0;
  // 	let c = 1000;
  // 	console.profile('glob.match');
  // 	while (c-- > 0) {
  // 		for (let path of paths) {
  // 			for (let pattern of patterns) {
  // 				let r = glob.match(pattern, path);
  // 				if (r) {
  // 					results += 42;
  // 				}
  // 			}
  // 		}
  // 	}
  // 	console.profileEnd();
  // });

  function assertGlobMatch(pattern: string | glob.IRelativePattern, input: string) {
    expect(glob.match(pattern, input)).toBeTruthy();
  }

  function assertNoGlobMatch(pattern: string | glob.IRelativePattern, input: string) {
    expect(!glob.match(pattern, input)).toBeTruthy();
  }

  it('simple', () => {
    let p = 'node_modules';

    assertGlobMatch(p, 'node_modules');
    assertNoGlobMatch(p, 'node_module');
    assertNoGlobMatch(p, '/node_modules');
    assertNoGlobMatch(p, 'test/node_modules');

    p = 'test.txt';
    assertGlobMatch(p, 'test.txt');
    assertNoGlobMatch(p, 'test?txt');
    assertNoGlobMatch(p, '/text.txt');
    assertNoGlobMatch(p, 'test/test.txt');

    p = 'test(.txt';
    assertGlobMatch(p, 'test(.txt');
    assertNoGlobMatch(p, 'test?txt');

    p = 'qunit';

    assertGlobMatch(p, 'qunit');
    assertNoGlobMatch(p, 'qunit.css');
    assertNoGlobMatch(p, 'test/qunit');

    // Absolute

    p = '/DNXConsoleApp/**/*.cs';
    assertGlobMatch(p, '/DNXConsoleApp/Program.cs');
    assertGlobMatch(p, '/DNXConsoleApp/foo/Program.cs');

    p = 'C:/DNXConsoleApp/**/*.cs';
    assertGlobMatch(p, 'C:\\DNXConsoleApp\\Program.cs');
    assertGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\Program.cs');

    p = '*';
    assertGlobMatch(p, '');
  });

  it('dot hidden', function () {
    let p = '.*';

    assertGlobMatch(p, '.git');
    assertGlobMatch(p, '.hidden.txt');
    assertNoGlobMatch(p, 'git');
    assertNoGlobMatch(p, 'hidden.txt');
    assertNoGlobMatch(p, 'path/.git');
    assertNoGlobMatch(p, 'path/.hidden.txt');

    p = '**/.*';
    assertGlobMatch(p, '.git');
    assertGlobMatch(p, '.hidden.txt');
    assertNoGlobMatch(p, 'git');
    assertNoGlobMatch(p, 'hidden.txt');
    assertGlobMatch(p, 'path/.git');
    assertGlobMatch(p, 'path/.hidden.txt');
    assertNoGlobMatch(p, 'path/git');
    assertNoGlobMatch(p, 'pat.h/hidden.txt');

    p = '._*';

    assertGlobMatch(p, '._git');
    assertGlobMatch(p, '._hidden.txt');
    assertNoGlobMatch(p, 'git');
    assertNoGlobMatch(p, 'hidden.txt');
    assertNoGlobMatch(p, 'path/._git');
    assertNoGlobMatch(p, 'path/._hidden.txt');

    p = '**/._*';
    assertGlobMatch(p, '._git');
    assertGlobMatch(p, '._hidden.txt');
    assertNoGlobMatch(p, 'git');
    assertNoGlobMatch(p, 'hidden._txt');
    assertGlobMatch(p, 'path/._git');
    assertGlobMatch(p, 'path/._hidden.txt');
    assertNoGlobMatch(p, 'path/git');
    assertNoGlobMatch(p, 'pat.h/hidden._txt');
  });

  it('file pattern', function () {
    let p = '*.js';

    assertGlobMatch(p, 'foo.js');
    assertNoGlobMatch(p, 'folder/foo.js');
    assertNoGlobMatch(p, '/node_modules/foo.js');
    assertNoGlobMatch(p, 'foo.jss');
    assertNoGlobMatch(p, 'some.js/test');

    p = 'html.*';
    assertGlobMatch(p, 'html.js');
    assertGlobMatch(p, 'html.txt');
    assertNoGlobMatch(p, 'htm.txt');

    p = '*.*';
    assertGlobMatch(p, 'html.js');
    assertGlobMatch(p, 'html.txt');
    assertGlobMatch(p, 'htm.txt');
    assertNoGlobMatch(p, 'folder/foo.js');
    assertNoGlobMatch(p, '/node_modules/foo.js');

    p = 'node_modules/test/*.js';
    assertGlobMatch(p, 'node_modules/test/foo.js');
    assertNoGlobMatch(p, 'folder/foo.js');
    assertNoGlobMatch(p, '/node_module/test/foo.js');
    assertNoGlobMatch(p, 'foo.jss');
    assertNoGlobMatch(p, 'some.js/test');
  });

  it('star', () => {
    let p = 'node*modules';

    assertGlobMatch(p, 'node_modules');
    assertGlobMatch(p, 'node_super_modules');
    assertNoGlobMatch(p, 'node_module');
    assertNoGlobMatch(p, '/node_modules');
    assertNoGlobMatch(p, 'test/node_modules');

    p = '*';
    assertGlobMatch(p, 'html.js');
    assertGlobMatch(p, 'html.txt');
    assertGlobMatch(p, 'htm.txt');
    assertNoGlobMatch(p, 'folder/foo.js');
    assertNoGlobMatch(p, '/node_modules/foo.js');
  });

  it('file / folder match', function () {
    const p = '**/node_modules/**';

    assertGlobMatch(p, 'node_modules');
    assertGlobMatch(p, 'node_modules/');
    assertGlobMatch(p, 'a/node_modules');
    assertGlobMatch(p, 'a/node_modules/');
    assertGlobMatch(p, 'node_modules/foo');
    assertGlobMatch(p, 'foo/node_modules/foo/bar');
  });

  it('questionmark', () => {
    let p = 'node?modules';

    assertGlobMatch(p, 'node_modules');
    assertNoGlobMatch(p, 'node_super_modules');
    assertNoGlobMatch(p, 'node_module');
    assertNoGlobMatch(p, '/node_modules');
    assertNoGlobMatch(p, 'test/node_modules');

    p = '?';
    assertGlobMatch(p, 'h');
    assertNoGlobMatch(p, 'html.txt');
    assertNoGlobMatch(p, 'htm.txt');
    assertNoGlobMatch(p, 'folder/foo.js');
    assertNoGlobMatch(p, '/node_modules/foo.js');
  });

  it('globstar', () => {
    let p = '**/*.js';

    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, 'folder/foo.js');
    assertGlobMatch(p, '/node_modules/foo.js');
    assertNoGlobMatch(p, 'foo.jss');
    assertNoGlobMatch(p, 'some.js/test');
    assertNoGlobMatch(p, '/some.js/test');
    assertNoGlobMatch(p, '\\some.js\\test');

    p = '**/project.json';

    assertGlobMatch(p, 'project.json');
    assertGlobMatch(p, '/project.json');
    assertGlobMatch(p, 'some/folder/project.json');
    assertNoGlobMatch(p, 'some/folder/file_project.json');
    assertNoGlobMatch(p, 'some/folder/fileproject.json');
    assertNoGlobMatch(p, 'some/rrproject.json');
    assertNoGlobMatch(p, 'some\\rrproject.json');

    p = 'test/**';
    assertGlobMatch(p, 'test');
    assertGlobMatch(p, 'test/foo.js');
    assertGlobMatch(p, 'test/other/foo.js');
    assertNoGlobMatch(p, 'est/other/foo.js');

    p = '**';
    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, 'folder/foo.js');
    assertGlobMatch(p, '/node_modules/foo.js');
    assertGlobMatch(p, 'foo.jss');
    assertGlobMatch(p, 'some.js/test');

    p = 'test/**/*.js';
    assertGlobMatch(p, 'test/foo.js');
    assertGlobMatch(p, 'test/other/foo.js');
    assertGlobMatch(p, 'test/other/more/foo.js');
    assertNoGlobMatch(p, 'test/foo.ts');
    assertNoGlobMatch(p, 'test/other/foo.ts');
    assertNoGlobMatch(p, 'test/other/more/foo.ts');

    p = '**/**/*.js';

    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, 'folder/foo.js');
    assertGlobMatch(p, '/node_modules/foo.js');
    assertNoGlobMatch(p, 'foo.jss');
    assertNoGlobMatch(p, 'some.js/test');

    p = '**/node_modules/**/*.js';

    assertNoGlobMatch(p, 'foo.js');
    assertNoGlobMatch(p, 'folder/foo.js');
    assertGlobMatch(p, 'node_modules/foo.js');
    assertGlobMatch(p, 'node_modules/some/folder/foo.js');
    assertNoGlobMatch(p, 'node_modules/some/folder/foo.ts');
    assertNoGlobMatch(p, 'foo.jss');
    assertNoGlobMatch(p, 'some.js/test');

    p = '{**/node_modules/**,**/.git/**,**/bower_components/**}';

    assertGlobMatch(p, 'node_modules');
    assertGlobMatch(p, '/node_modules');
    assertGlobMatch(p, '/node_modules/more');
    assertGlobMatch(p, 'some/test/node_modules');
    assertGlobMatch(p, 'some\\test\\node_modules');
    assertGlobMatch(p, 'C:\\\\some\\test\\node_modules');
    assertGlobMatch(p, 'C:\\\\some\\test\\node_modules\\more');

    assertGlobMatch(p, 'bower_components');
    assertGlobMatch(p, 'bower_components/more');
    assertGlobMatch(p, '/bower_components');
    assertGlobMatch(p, 'some/test/bower_components');
    assertGlobMatch(p, 'some\\test\\bower_components');
    assertGlobMatch(p, 'C:\\\\some\\test\\bower_components');
    assertGlobMatch(p, 'C:\\\\some\\test\\bower_components\\more');

    assertGlobMatch(p, '.git');
    assertGlobMatch(p, '/.git');
    assertGlobMatch(p, 'some/test/.git');
    assertGlobMatch(p, 'some\\test\\.git');
    assertGlobMatch(p, 'C:\\\\some\\test\\.git');

    assertNoGlobMatch(p, 'tempting');
    assertNoGlobMatch(p, '/tempting');
    assertNoGlobMatch(p, 'some/test/tempting');
    assertNoGlobMatch(p, 'some\\test\\tempting');
    assertNoGlobMatch(p, 'C:\\\\some\\test\\tempting');

    p = '{**/package.json,**/project.json}';
    assertGlobMatch(p, 'package.json');
    assertGlobMatch(p, '/package.json');
    assertNoGlobMatch(p, 'xpackage.json');
    assertNoGlobMatch(p, '/xpackage.json');
  });

  it('issue 41724', function () {
    let p = 'some/**/*.js';

    assertGlobMatch(p, 'some/foo.js');
    assertGlobMatch(p, 'some/folder/foo.js');
    assertNoGlobMatch(p, 'something/foo.js');
    assertNoGlobMatch(p, 'something/folder/foo.js');

    p = 'some/**/*';

    assertGlobMatch(p, 'some/foo.js');
    assertGlobMatch(p, 'some/folder/foo.js');
    assertNoGlobMatch(p, 'something/foo.js');
    assertNoGlobMatch(p, 'something/folder/foo.js');
  });

  it('brace expansion', function () {
    let p = '*.{html,js}';

    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, 'foo.html');
    assertNoGlobMatch(p, 'folder/foo.js');
    assertNoGlobMatch(p, '/node_modules/foo.js');
    assertNoGlobMatch(p, 'foo.jss');
    assertNoGlobMatch(p, 'some.js/test');

    p = '*.{html}';

    assertGlobMatch(p, 'foo.html');
    assertNoGlobMatch(p, 'foo.js');
    assertNoGlobMatch(p, 'folder/foo.js');
    assertNoGlobMatch(p, '/node_modules/foo.js');
    assertNoGlobMatch(p, 'foo.jss');
    assertNoGlobMatch(p, 'some.js/test');

    p = '{node_modules,testing}';
    assertGlobMatch(p, 'node_modules');
    assertGlobMatch(p, 'testing');
    assertNoGlobMatch(p, 'node_module');
    assertNoGlobMatch(p, 'dtesting');

    p = '**/{foo,bar}';
    assertGlobMatch(p, 'foo');
    assertGlobMatch(p, 'bar');
    assertGlobMatch(p, 'test/foo');
    assertGlobMatch(p, 'test/bar');
    assertGlobMatch(p, 'other/more/foo');
    assertGlobMatch(p, 'other/more/bar');

    p = '{foo,bar}/**';
    assertGlobMatch(p, 'foo');
    assertGlobMatch(p, 'bar');
    assertGlobMatch(p, 'foo/test');
    assertGlobMatch(p, 'bar/test');
    assertGlobMatch(p, 'foo/other/more');
    assertGlobMatch(p, 'bar/other/more');

    p = '{**/*.d.ts,**/*.js}';

    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, 'testing/foo.js');
    assertGlobMatch(p, 'testing\\foo.js');
    assertGlobMatch(p, '/testing/foo.js');
    assertGlobMatch(p, '\\testing\\foo.js');
    assertGlobMatch(p, 'C:\\testing\\foo.js');

    assertGlobMatch(p, 'foo.d.ts');
    assertGlobMatch(p, 'testing/foo.d.ts');
    assertGlobMatch(p, 'testing\\foo.d.ts');
    assertGlobMatch(p, '/testing/foo.d.ts');
    assertGlobMatch(p, '\\testing\\foo.d.ts');
    assertGlobMatch(p, 'C:\\testing\\foo.d.ts');

    assertNoGlobMatch(p, 'foo.d');
    assertNoGlobMatch(p, 'testing/foo.d');
    assertNoGlobMatch(p, 'testing\\foo.d');
    assertNoGlobMatch(p, '/testing/foo.d');
    assertNoGlobMatch(p, '\\testing\\foo.d');
    assertNoGlobMatch(p, 'C:\\testing\\foo.d');

    p = '{**/*.d.ts,**/*.js,path/simple.jgs}';

    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, 'testing/foo.js');
    assertGlobMatch(p, 'testing\\foo.js');
    assertGlobMatch(p, '/testing/foo.js');
    assertGlobMatch(p, 'path/simple.jgs');
    assertNoGlobMatch(p, '/path/simple.jgs');
    assertGlobMatch(p, '\\testing\\foo.js');
    assertGlobMatch(p, 'C:\\testing\\foo.js');

    p = '{**/*.d.ts,**/*.js,foo.[0-9]}';

    assertGlobMatch(p, 'foo.5');
    assertGlobMatch(p, 'foo.8');
    assertNoGlobMatch(p, 'bar.5');
    assertNoGlobMatch(p, 'foo.f');
    assertGlobMatch(p, 'foo.js');

    p = 'prefix/{**/*.d.ts,**/*.js,foo.[0-9]}';

    assertGlobMatch(p, 'prefix/foo.5');
    assertGlobMatch(p, 'prefix/foo.8');
    assertNoGlobMatch(p, 'prefix/bar.5');
    assertNoGlobMatch(p, 'prefix/foo.f');
    assertGlobMatch(p, 'prefix/foo.js');
  });

  it('expression support (single)', function () {
    const siblings = ['test.html', 'test.txt', 'test.ts', 'test.js'];
    const hasSibling = (name: string) => siblings.indexOf(name) !== -1;

    // { "**/*.js": { "when": "$(basename).ts" } }
    let expression: glob.IExpression = {
      '**/*.js': {
        when: '$(basename).ts',
      },
    };

    expect('**/*.js').toBe(glob.match(expression, 'test.js', hasSibling));
    expect(glob.match(expression, 'test.js', () => false)).toBe(null);
    expect(glob.match(expression, 'test.js', (name) => name === 'te.ts')).toBe(null);
    expect(glob.match(expression, 'test.js')).toBe(null);

    expression = {
      '**/*.js': {
        when: '',
      },
    };

    expect(glob.match(expression, 'test.js', hasSibling)).toBe(null);

    expression = {
      '**/*.js': {} as any,
    };

    expect('**/*.js').toBe(glob.match(expression, 'test.js', hasSibling));

    expression = {};

    expect(glob.match(expression, 'test.js', hasSibling)).toBe(null);
  });

  it('expression support (multiple)', function () {
    const siblings = ['test.html', 'test.txt', 'test.ts', 'test.js'];
    const hasSibling = (name: string) => siblings.indexOf(name) !== -1;

    // { "**/*.js": { "when": "$(basename).ts" } }
    const expression: glob.IExpression = {
      '**/*.js': { when: '$(basename).ts' },
      '**/*.as': true,
      '**/*.foo': false,
      '**/*.bananas': { bananas: true } as any,
    };

    expect('**/*.js').toBe(glob.match(expression, 'test.js', hasSibling));
    expect('**/*.as').toBe(glob.match(expression, 'test.as', hasSibling));
    expect('**/*.bananas').toBe(glob.match(expression, 'test.bananas', hasSibling));
    expect('**/*.bananas').toBe(glob.match(expression, 'test.bananas'));
    expect(glob.match(expression, 'test.foo', hasSibling)).toBe(null);
  });

  it('brackets', () => {
    let p = 'foo.[0-9]';

    assertGlobMatch(p, 'foo.5');
    assertGlobMatch(p, 'foo.8');
    assertNoGlobMatch(p, 'bar.5');
    assertNoGlobMatch(p, 'foo.f');

    p = 'foo.[^0-9]';

    assertNoGlobMatch(p, 'foo.5');
    assertNoGlobMatch(p, 'foo.8');
    assertNoGlobMatch(p, 'bar.5');
    assertGlobMatch(p, 'foo.f');

    p = 'foo.[!0-9]';

    assertNoGlobMatch(p, 'foo.5');
    assertNoGlobMatch(p, 'foo.8');
    assertNoGlobMatch(p, 'bar.5');
    assertGlobMatch(p, 'foo.f');

    p = 'foo.[0!^*?]';

    assertNoGlobMatch(p, 'foo.5');
    assertNoGlobMatch(p, 'foo.8');
    assertGlobMatch(p, 'foo.0');
    assertGlobMatch(p, 'foo.!');
    assertGlobMatch(p, 'foo.^');
    assertGlobMatch(p, 'foo.*');
    assertGlobMatch(p, 'foo.?');

    p = 'foo[/]bar';

    assertNoGlobMatch(p, 'foo/bar');

    p = 'foo.[[]';

    assertGlobMatch(p, 'foo.[');

    p = 'foo.[]]';

    assertGlobMatch(p, 'foo.]');

    p = 'foo.[][!]';

    assertGlobMatch(p, 'foo.]');
    assertGlobMatch(p, 'foo.[');
    assertGlobMatch(p, 'foo.!');

    p = 'foo.[]-]';

    assertGlobMatch(p, 'foo.]');
    assertGlobMatch(p, 'foo.-');
  });

  it('full path', function () {
    const p = 'testing/this/foo.txt';

    expect(glob.match(p, nativeSep('testing/this/foo.txt'))).toBeTruthy();
  });

  it('prefix agnostic', function () {
    let p = '**/*.js';

    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, '/foo.js');
    assertGlobMatch(p, '\\foo.js');
    assertGlobMatch(p, 'testing/foo.js');
    assertGlobMatch(p, 'testing\\foo.js');
    assertGlobMatch(p, '/testing/foo.js');
    assertGlobMatch(p, '\\testing\\foo.js');
    assertGlobMatch(p, 'C:\\testing\\foo.js');

    assertNoGlobMatch(p, 'foo.ts');
    assertNoGlobMatch(p, 'testing/foo.ts');
    assertNoGlobMatch(p, 'testing\\foo.ts');
    assertNoGlobMatch(p, '/testing/foo.ts');
    assertNoGlobMatch(p, '\\testing\\foo.ts');
    assertNoGlobMatch(p, 'C:\\testing\\foo.ts');

    assertNoGlobMatch(p, 'foo.js.txt');
    assertNoGlobMatch(p, 'testing/foo.js.txt');
    assertNoGlobMatch(p, 'testing\\foo.js.txt');
    assertNoGlobMatch(p, '/testing/foo.js.txt');
    assertNoGlobMatch(p, '\\testing\\foo.js.txt');
    assertNoGlobMatch(p, 'C:\\testing\\foo.js.txt');

    assertNoGlobMatch(p, 'testing.js/foo');
    assertNoGlobMatch(p, 'testing.js\\foo');
    assertNoGlobMatch(p, '/testing.js/foo');
    assertNoGlobMatch(p, '\\testing.js\\foo');
    assertNoGlobMatch(p, 'C:\\testing.js\\foo');

    p = '**/foo.js';

    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, '/foo.js');
    assertGlobMatch(p, '\\foo.js');
    assertGlobMatch(p, 'testing/foo.js');
    assertGlobMatch(p, 'testing\\foo.js');
    assertGlobMatch(p, '/testing/foo.js');
    assertGlobMatch(p, '\\testing\\foo.js');
    assertGlobMatch(p, 'C:\\testing\\foo.js');
  });

  it('cached properly', function () {
    const p = '**/*.js';

    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, 'testing/foo.js');
    assertGlobMatch(p, 'testing\\foo.js');
    assertGlobMatch(p, '/testing/foo.js');
    assertGlobMatch(p, '\\testing\\foo.js');
    assertGlobMatch(p, 'C:\\testing\\foo.js');

    assertNoGlobMatch(p, 'foo.ts');
    assertNoGlobMatch(p, 'testing/foo.ts');
    assertNoGlobMatch(p, 'testing\\foo.ts');
    assertNoGlobMatch(p, '/testing/foo.ts');
    assertNoGlobMatch(p, '\\testing\\foo.ts');
    assertNoGlobMatch(p, 'C:\\testing\\foo.ts');

    assertNoGlobMatch(p, 'foo.js.txt');
    assertNoGlobMatch(p, 'testing/foo.js.txt');
    assertNoGlobMatch(p, 'testing\\foo.js.txt');
    assertNoGlobMatch(p, '/testing/foo.js.txt');
    assertNoGlobMatch(p, '\\testing\\foo.js.txt');
    assertNoGlobMatch(p, 'C:\\testing\\foo.js.txt');

    assertNoGlobMatch(p, 'testing.js/foo');
    assertNoGlobMatch(p, 'testing.js\\foo');
    assertNoGlobMatch(p, '/testing.js/foo');
    assertNoGlobMatch(p, '\\testing.js\\foo');
    assertNoGlobMatch(p, 'C:\\testing.js\\foo');

    // Run again and make sure the regex are properly reused

    assertGlobMatch(p, 'foo.js');
    assertGlobMatch(p, 'testing/foo.js');
    assertGlobMatch(p, 'testing\\foo.js');
    assertGlobMatch(p, '/testing/foo.js');
    assertGlobMatch(p, '\\testing\\foo.js');
    assertGlobMatch(p, 'C:\\testing\\foo.js');

    assertNoGlobMatch(p, 'foo.ts');
    assertNoGlobMatch(p, 'testing/foo.ts');
    assertNoGlobMatch(p, 'testing\\foo.ts');
    assertNoGlobMatch(p, '/testing/foo.ts');
    assertNoGlobMatch(p, '\\testing\\foo.ts');
    assertNoGlobMatch(p, 'C:\\testing\\foo.ts');

    assertNoGlobMatch(p, 'foo.js.txt');
    assertNoGlobMatch(p, 'testing/foo.js.txt');
    assertNoGlobMatch(p, 'testing\\foo.js.txt');
    assertNoGlobMatch(p, '/testing/foo.js.txt');
    assertNoGlobMatch(p, '\\testing\\foo.js.txt');
    assertNoGlobMatch(p, 'C:\\testing\\foo.js.txt');

    assertNoGlobMatch(p, 'testing.js/foo');
    assertNoGlobMatch(p, 'testing.js\\foo');
    assertNoGlobMatch(p, '/testing.js/foo');
    assertNoGlobMatch(p, '\\testing.js\\foo');
    assertNoGlobMatch(p, 'C:\\testing.js\\foo');
  });

  it('invalid glob', function () {
    const p = '**/*(.js';

    assertNoGlobMatch(p, 'foo.js');
  });

  it('split glob aware', function () {
    expect(glob.splitGlobAware('foo,bar', ',')).toEqual(['foo', 'bar']);
    expect(glob.splitGlobAware('foo', ',')).toEqual(['foo']);
    expect(glob.splitGlobAware('{foo,bar}', ',')).toEqual(['{foo,bar}']);
    expect(glob.splitGlobAware('foo,bar,{foo,bar}', ',')).toEqual(['foo', 'bar', '{foo,bar}']);
    expect(glob.splitGlobAware('{foo,bar},foo,bar,{foo,bar}', ',')).toEqual(['{foo,bar}', 'foo', 'bar', '{foo,bar}']);

    expect(glob.splitGlobAware('[foo,bar]', ',')).toEqual(['[foo,bar]']);
    expect(glob.splitGlobAware('foo,bar,[foo,bar]', ',')).toEqual(['foo', 'bar', '[foo,bar]']);
    expect(glob.splitGlobAware('[foo,bar],foo,bar,[foo,bar]', ',')).toEqual(['[foo,bar]', 'foo', 'bar', '[foo,bar]']);
  });

  it('expression with disabled glob', function () {
    const expr = { '**/*.js': false };

    expect(glob.match(expr, 'foo.js')).toBe(null);
  });

  it('expression with two non-trivia globs', function () {
    const expr = {
      '**/*.j?': true,
      '**/*.t?': true,
    };

    expect(glob.match(expr, 'foo.js')).toBe('**/*.j?');
    expect(glob.match(expr, 'foo.as')).toBe(null);
  });

  it('expression with empty glob', function () {
    const expr = { '': true };

    expect(glob.match(expr, 'foo.js')).toBe(null);
  });

  it('expression with other falsy value', function () {
    const expr = { '**/*.js': 0 } as any;

    expect(glob.match(expr, 'foo.js')).toBe('**/*.js');
  });

  it('expression with two basename globs', function () {
    const expr = {
      '**/bar': true,
      '**/baz': true,
    };

    expect(glob.match(expr, 'bar')).toBe('**/bar');
    expect(glob.match(expr, 'foo')).toBe(null);
    expect(glob.match(expr, 'foo/bar')).toBe('**/bar');
    expect(glob.match(expr, 'foo\\bar')).toBe('**/bar');
    expect(glob.match(expr, 'foo/foo')).toBe(null);
  });

  it('expression with two basename globs and a siblings expression', function () {
    const expr = {
      '**/bar': true,
      '**/baz': true,
      '**/*.js': { when: '$(basename).ts' },
    };

    const siblings = ['foo.ts', 'foo.js', 'foo', 'bar'];
    const hasSibling = (name: string) => siblings.indexOf(name) !== -1;

    expect(glob.match(expr, 'bar', hasSibling)).toBe('**/bar');
    expect(glob.match(expr, 'foo', hasSibling)).toBe(null);
    expect(glob.match(expr, 'foo/bar', hasSibling)).toBe('**/bar');
    if (isWindows) {
      // backslash is a valid file name character on posix
      expect(glob.match(expr, 'foo\\bar', hasSibling)).toBe('**/bar');
    }
    expect(glob.match(expr, 'foo/foo', hasSibling)).toBe(null);
    expect(glob.match(expr, 'foo.js', hasSibling)).toBe('**/*.js');
    expect(glob.match(expr, 'bar.js', hasSibling)).toBe(null);
  });

  it('expression with multipe basename globs', function () {
    const expr = {
      '**/bar': true,
      '{**/baz,**/foo}': true,
    };

    expect(glob.match(expr, 'bar')).toBe('**/bar');
    expect(glob.match(expr, 'foo')).toBe('{**/baz,**/foo}');
    expect(glob.match(expr, 'baz')).toBe('{**/baz,**/foo}');
    expect(glob.match(expr, 'abc')).toBe(null);
  });

  it('falsy expression/pattern', function () {
    expect(glob.match(null!, 'foo')).toBe(false);
    expect(glob.match('', 'foo')).toBe(false);
    expect(glob.parse(null!)('foo')).toBe(false);
    expect(glob.parse('')('foo')).toBe(false);
  });

  it('falsy path', function () {
    expect(glob.parse('foo')(null!)).toBe(false);
    expect(glob.parse('foo')('')).toBe(false);
    expect(glob.parse('**/*.j?')(null!)).toBe(false);
    expect(glob.parse('**/*.j?')('')).toBe(false);
    expect(glob.parse('**/*.foo')(null!)).toBe(false);
    expect(glob.parse('**/*.foo')('')).toBe(false);
    expect(glob.parse('**/foo')(null!)).toBe(false);
    expect(glob.parse('**/foo')('')).toBe(false);
    expect(glob.parse('{**/baz,**/foo}')(null!)).toBe(false);
    expect(glob.parse('{**/baz,**/foo}')('')).toBe(false);
    expect(glob.parse('{**/*.baz,**/*.foo}')(null!)).toBe(false);
    expect(glob.parse('{**/*.baz,**/*.foo}')('')).toBe(false);
  });

  it('expression/pattern basename', function () {
    expect(glob.parse('**/foo')('bar/baz', 'baz')).toBe(false);
    expect(glob.parse('**/foo')('bar/foo', 'foo')).toBe(true);

    expect(glob.parse('{**/baz,**/foo}')('baz/bar', 'bar')).toBe(false);
    expect(glob.parse('{**/baz,**/foo}')('baz/foo', 'foo')).toBe(true);

    const expr = { '**/*.js': { when: '$(basename).ts' } };
    const siblings = ['foo.ts', 'foo.js'];
    const hasSibling = (name: string) => siblings.indexOf(name) !== -1;

    expect(glob.parse(expr)('bar/baz.js', 'baz.js', hasSibling)).toBe(null);
    expect(glob.parse(expr)('bar/foo.js', 'foo.js', hasSibling)).toBe('**/*.js');
  });

  it('expression/pattern basename terms', function () {
    expect(glob.getBasenameTerms(glob.parse('**/*.foo'))).toEqual([]);
    expect(glob.getBasenameTerms(glob.parse('**/foo'))).toEqual(['foo']);
    expect(glob.getBasenameTerms(glob.parse('**/foo/'))).toEqual(['foo']);
    expect(glob.getBasenameTerms(glob.parse('{**/baz,**/foo}'))).toEqual(['baz', 'foo']);
    expect(glob.getBasenameTerms(glob.parse('{**/baz/,**/foo/}'))).toEqual(['baz', 'foo']);

    expect(
      glob.getBasenameTerms(
        glob.parse({
          '**/foo': true,
          '{**/bar,**/baz}': true,
          '{**/bar2/,**/baz2/}': true,
          '**/bulb': false,
        }),
      ),
    ).toEqual(['foo', 'bar', 'baz', 'bar2', 'baz2']);
    expect(
      glob.getBasenameTerms(
        glob.parse({
          '**/foo': { when: '$(basename).zip' },
          '**/bar': true,
        }),
      ),
    ).toEqual(['bar']);
  });

  it('expression/pattern optimization for basenames', function () {
    expect(glob.getBasenameTerms(glob.parse('**/foo/**'))).toEqual([]);
    expect(glob.getBasenameTerms(glob.parse('**/foo/**', { trimForExclusions: true }))).toEqual(['foo']);

    testOptimizationForBasenames('**/*.foo/**', [], [['baz/bar.foo/bar/baz', true]]);
    testOptimizationForBasenames(
      '**/foo/**',
      ['foo'],
      [
        ['bar/foo', true],
        ['bar/foo/baz', false],
      ],
    );
    testOptimizationForBasenames(
      '{**/baz/**,**/foo/**}',
      ['baz', 'foo'],
      [
        ['bar/baz', true],
        ['bar/foo', true],
      ],
    );

    testOptimizationForBasenames(
      {
        '**/foo/**': true,
        '{**/bar/**,**/baz/**}': true,
        '**/bulb/**': false,
      },
      ['foo', 'bar', 'baz'],
      [
        ['bar/foo', '**/foo/**'],
        ['foo/bar', '{**/bar/**,**/baz/**}'],
        ['bar/nope', null!],
      ],
    );

    const siblings = ['baz', 'baz.zip', 'nope'];
    const hasSibling = (name: string) => siblings.indexOf(name) !== -1;
    testOptimizationForBasenames(
      {
        '**/foo/**': { when: '$(basename).zip' },
        '**/bar/**': true,
      },
      ['bar'],
      [
        ['bar/foo', null!],
        ['bar/foo/baz', null!],
        ['bar/foo/nope', null!],
        ['foo/bar', '**/bar/**'],
      ],
      [null!, hasSibling, hasSibling],
    );
  });

  function testOptimizationForBasenames(
    pattern: string | glob.IExpression,
    basenameTerms: string[],
    matches: [string, string | boolean][],
    siblingsFns: ((name: string) => boolean)[] = [],
  ) {
    const parsed = glob.parse(pattern as glob.IExpression, { trimForExclusions: true });
    expect(glob.getBasenameTerms(parsed)).toEqual(basenameTerms);
    matches.forEach(([text, result], i) => {
      expect(parsed(text, null!, siblingsFns[i])).toBe(result);
    });
  }

  it('trailing slash', function () {
    // Testing existing (more or less intuitive) behavior
    expect(glob.parse('**/foo/')('bar/baz', 'baz')).toBe(false);
    expect(glob.parse('**/foo/')('bar/foo', 'foo')).toBe(true);
    expect(glob.parse('**/*.foo/')('bar/file.baz', 'file.baz')).toBe(false);
    expect(glob.parse('**/*.foo/')('bar/file.foo', 'file.foo')).toBe(true);
    expect(glob.parse('{**/foo/,**/abc/}')('bar/baz', 'baz')).toBe(false);
    expect(glob.parse('{**/foo/,**/abc/}')('bar/foo', 'foo')).toBe(true);
    expect(glob.parse('{**/foo/,**/abc/}')('bar/abc', 'abc')).toBe(true);
    expect(glob.parse('{**/foo/,**/abc/}', { trimForExclusions: true })('bar/baz', 'baz')).toBe(false);
    expect(glob.parse('{**/foo/,**/abc/}', { trimForExclusions: true })('bar/foo', 'foo')).toBe(true);
    expect(glob.parse('{**/foo/,**/abc/}', { trimForExclusions: true })('bar/abc', 'abc')).toBe(true);
  });

  it('expression/pattern path', function () {
    expect(glob.parse('**/foo/bar')(nativeSep('foo/baz'), 'baz')).toBe(false);
    expect(glob.parse('**/foo/bar')(nativeSep('foo/bar'), 'bar')).toBe(true);
    expect(glob.parse('**/foo/bar')(nativeSep('bar/foo/bar'), 'bar')).toBe(true);
    expect(glob.parse('**/foo/bar/**')(nativeSep('bar/foo/bar'), 'bar')).toBe(true);
    expect(glob.parse('**/foo/bar/**')(nativeSep('bar/foo/bar/baz'), 'baz')).toBe(true);
    expect(glob.parse('**/foo/bar/**', { trimForExclusions: true })(nativeSep('bar/foo/bar'), 'bar')).toBe(true);
    expect(glob.parse('**/foo/bar/**', { trimForExclusions: true })(nativeSep('bar/foo/bar/baz'), 'baz')).toBe(false);

    expect(glob.parse('foo/bar')(nativeSep('foo/baz'), 'baz')).toBe(false);
    expect(glob.parse('foo/bar')(nativeSep('foo/bar'), 'bar')).toBe(true);
    expect(glob.parse('foo/bar/baz')(nativeSep('foo/bar/baz'), 'baz')).toBe(true); // #15424
    expect(glob.parse('foo/bar')(nativeSep('bar/foo/bar'), 'bar')).toBe(false);
    expect(glob.parse('foo/bar/**')(nativeSep('foo/bar/baz'), 'baz')).toBe(true);
    expect(glob.parse('foo/bar/**', { trimForExclusions: true })(nativeSep('foo/bar'), 'bar')).toBe(true);
    expect(glob.parse('foo/bar/**', { trimForExclusions: true })(nativeSep('foo/bar/baz'), 'baz')).toBe(false);
  });

  it('expression/pattern paths', function () {
    expect(glob.getPathTerms(glob.parse('**/*.foo'))).toStrictEqual([]);
    expect(glob.getPathTerms(glob.parse('**/foo'))).toStrictEqual([]);
    expect(glob.getPathTerms(glob.parse('**/foo/bar'))).toStrictEqual(['*/foo/bar']);
    expect(glob.getPathTerms(glob.parse('**/foo/bar/'))).toStrictEqual(['*/foo/bar']);
    // Not supported
    // expect(glob.getPathTerms(glob.parse('{**/baz/bar,**/foo/bar,**/bar}'))).toStrictEqual(['*/baz/bar', '*/foo/bar']);
    // expect(glob.getPathTerms(glob.parse('{**/baz/bar/,**/foo/bar/,**/bar/}'))).toStrictEqual(['*/baz/bar', '*/foo/bar']);

    const parsed = glob.parse({
      '**/foo/bar': true,
      '**/foo2/bar2': true,
      // Not supported
      // '{**/bar/foo,**/baz/foo}': true,
      // '{**/bar2/foo/,**/baz2/foo/}': true,
      '**/bulb': true,
      '**/bulb2': true,
      '**/bulb/foo': false,
    });
    expect(glob.getPathTerms(parsed)).toEqual(['*/foo/bar', '*/foo2/bar2']);
    expect(glob.getBasenameTerms(parsed)).toEqual(['bulb', 'bulb2']);
    expect(
      glob.getPathTerms(
        glob.parse({
          '**/foo/bar': { when: '$(basename).zip' },
          '**/bar/foo': true,
          '**/bar2/foo2': true,
        }),
      ),
    ).toEqual(['*/bar/foo', '*/bar2/foo2']);
  });

  it('expression/pattern optimization for paths', function () {
    expect(glob.getPathTerms(glob.parse('**/foo/bar/**'))).toEqual([]);
    expect(glob.getPathTerms(glob.parse('**/foo/bar/**', { trimForExclusions: true }))).toEqual(['*/foo/bar']);

    testOptimizationForPaths('**/*.foo/bar/**', [], [[nativeSep('baz/bar.foo/bar/baz'), true]]);
    testOptimizationForPaths(
      '**/foo/bar/**',
      ['*/foo/bar'],
      [
        [nativeSep('bar/foo/bar'), true],
        [nativeSep('bar/foo/bar/baz'), false],
      ],
    );
    // Not supported
    // testOptimizationForPaths('{**/baz/bar/**,**/foo/bar/**}', ['*/baz/bar', '*/foo/bar'], [[nativeSep('bar/baz/bar'), true], [nativeSep('bar/foo/bar'), true]]);

    testOptimizationForPaths(
      {
        '**/foo/bar/**': true,
        // Not supported
        // '{**/bar/bar/**,**/baz/bar/**}': true,
        '**/bulb/bar/**': false,
      },
      ['*/foo/bar'],
      [
        [nativeSep('bar/foo/bar'), '**/foo/bar/**'],
        // Not supported
        // [nativeSep('foo/bar/bar'), '{**/bar/bar/**,**/baz/bar/**}'],
        [nativeSep('/foo/bar/nope'), null!],
      ],
    );

    const siblings = ['baz', 'baz.zip', 'nope'];
    const hasSibling = (name: string) => siblings.indexOf(name) !== -1;
    testOptimizationForPaths(
      {
        '**/foo/123/**': { when: '$(basename).zip' },
        '**/bar/123/**': true,
      },
      ['*/bar/123'],
      [
        [nativeSep('bar/foo/123'), null!],
        [nativeSep('bar/foo/123/baz'), null!],
        [nativeSep('bar/foo/123/nope'), null!],
        [nativeSep('foo/bar/123'), '**/bar/123/**'],
      ],
      [null!, hasSibling, hasSibling],
    );
  });

  function testOptimizationForPaths(
    pattern: string | glob.IExpression,
    pathTerms: string[],
    matches: [string, string | boolean][],
    siblingsFns: ((name: string) => boolean)[] = [],
  ) {
    const parsed = glob.parse(pattern as glob.IExpression, { trimForExclusions: true });
    expect(glob.getPathTerms(parsed)).toEqual(pathTerms);
    matches.forEach(([text, result], i) => {
      expect(parsed(text, null!, siblingsFns[i])).toBe(result);
    });
  }

  function nativeSep(slashPath: string): string {
    return slashPath.replace(/\//g, path.sep);
  }

  it('relative pattern - glob star', function () {
    if (isWindows) {
      const p: glob.IRelativePattern = { base: 'C:\\DNXConsoleApp\\foo', pattern: '**/*.cs' };
      assertGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\Program.cs');
      assertGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\bar\\Program.cs');
      assertNoGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\Program.ts');
      assertNoGlobMatch(p, 'C:\\DNXConsoleApp\\Program.cs');
      assertNoGlobMatch(p, 'C:\\other\\DNXConsoleApp\\foo\\Program.ts');
    } else {
      const p: glob.IRelativePattern = { base: '/DNXConsoleApp/foo', pattern: '**/*.cs' };
      assertGlobMatch(p, '/DNXConsoleApp/foo/Program.cs');
      assertGlobMatch(p, '/DNXConsoleApp/foo/bar/Program.cs');
      assertNoGlobMatch(p, '/DNXConsoleApp/foo/Program.ts');
      assertNoGlobMatch(p, '/DNXConsoleApp/Program.cs');
      assertNoGlobMatch(p, '/other/DNXConsoleApp/foo/Program.ts');
    }
  });

  it('relative pattern - single star', function () {
    if (isWindows) {
      const p: glob.IRelativePattern = { base: 'C:\\DNXConsoleApp\\foo', pattern: '*.cs' };
      assertGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\Program.cs');
      assertNoGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\bar\\Program.cs');
      assertNoGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\Program.ts');
      assertNoGlobMatch(p, 'C:\\DNXConsoleApp\\Program.cs');
      assertNoGlobMatch(p, 'C:\\other\\DNXConsoleApp\\foo\\Program.ts');
    } else {
      const p: glob.IRelativePattern = { base: '/DNXConsoleApp/foo', pattern: '*.cs' };
      assertGlobMatch(p, '/DNXConsoleApp/foo/Program.cs');
      assertNoGlobMatch(p, '/DNXConsoleApp/foo/bar/Program.cs');
      assertNoGlobMatch(p, '/DNXConsoleApp/foo/Program.ts');
      assertNoGlobMatch(p, '/DNXConsoleApp/Program.cs');
      assertNoGlobMatch(p, '/other/DNXConsoleApp/foo/Program.ts');
    }
  });

  it('relative pattern - single star with path', function () {
    if (isWindows) {
      const p: glob.IRelativePattern = { base: 'C:\\DNXConsoleApp\\foo', pattern: 'something/*.cs' };
      assertGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\something\\Program.cs');
      assertNoGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\Program.cs');
    } else {
      const p: glob.IRelativePattern = { base: '/DNXConsoleApp/foo', pattern: 'something/*.cs' };
      assertGlobMatch(p, '/DNXConsoleApp/foo/something/Program.cs');
      assertNoGlobMatch(p, '/DNXConsoleApp/foo/Program.cs');
    }
  });

  it('pattern with "base" does not explode - #36081', function () {
    expect(glob.match({ base: true }, 'base')).toBeTruthy();
  });

  it('relative pattern - #57475', function () {
    if (isWindows) {
      const p: glob.IRelativePattern = { base: 'C:\\DNXConsoleApp\\foo', pattern: 'styles/style.css' };
      assertGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\styles\\style.css');
      assertNoGlobMatch(p, 'C:\\DNXConsoleApp\\foo\\Program.cs');
    } else {
      const p: glob.IRelativePattern = { base: '/DNXConsoleApp/foo', pattern: 'styles/style.css' };
      assertGlobMatch(p, '/DNXConsoleApp/foo/styles/style.css');
      assertNoGlobMatch(p, '/DNXConsoleApp/foo/Program.cs');
    }
  });
});
