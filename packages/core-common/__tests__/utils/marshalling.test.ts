// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/marshalling.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { URI } from 'vscode-uri';

import { parse, stringify } from '../../src/utils/marshalling';

describe('Marshalling', () => {
  test('RegExp', () => {
    const value = /foo/gim;
    const raw = stringify(value);
    const clone = parse(raw) as RegExp;

    expect(value.source).toEqual(clone.source);
    expect(value.global).toEqual(clone.global);
    expect(value.ignoreCase).toEqual(clone.ignoreCase);
    expect(value.multiline).toEqual(clone.multiline);
  });

  test('URI', () => {
    const value = URI.from({ scheme: 'file', authority: 'server', path: '/shares/c#files', query: 'q', fragment: 'f' });
    const raw = stringify(value);
    const clone = parse(raw) as URI;

    expect(value.scheme).toEqual(clone.scheme);
    expect(value.authority).toEqual(clone.authority);
    expect(value.path).toEqual(clone.path);
    expect(value.query).toEqual(clone.query);
    expect(value.fragment).toEqual(clone.fragment);
  });

  test('Bug 16793:# in folder name => mirror models get out of sync', () => {
    const uri1 = URI.file('C:\\C#\\file.txt');
    expect(parse(stringify(uri1)).toString()).toEqual(uri1.toString());
  });
});
