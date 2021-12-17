/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../src/uri';

describe('uri', () => {
  describe('#getParent', () => {
    it('of file:///foo/bar.txt', () => {
      expect(new URI('file:///foo/bar.txt').parent.toString()).toBe('file:///foo');
    });

    it('of file:///foo/', () => {
      expect(new URI('file:///foo/').parent.toString()).toBe('file:///foo');
    });

    it('of file:///foo', () => {
      expect(new URI('file:///foo').parent.toString()).toBe('file:///');
    });

    it('of file:///', () => {
      expect(new URI('file:///').parent.toString()).toBe('file:///');
    });

    it('of file://', () => {
      expect(new URI('file://').parent.toString()).toBe('file:///');
    });
  });

  describe('#lastSegment', () => {
    it('of file:///foo/bar.txt', () => {
      expect(new URI('file:///foo/bar.txt').path.base).toBe('bar.txt');
    });

    it('of file:///foo', () => {
      expect(new URI('file:///foo').path.base).toBe('foo');
    });

    it('of file:///', () => {
      expect(new URI('file:///').path.base).toBe('');
    });

    it('of file://', () => {
      expect(new URI('file://').path.base).toBe('');
    });
  });

  describe('#appendPath', () => {
    it("'' to file:///foo", () => {
      const uri = new URI('file:///foo');
      expect(uri.resolve('').toString()).toBe(uri.toString());
    });

    it('bar to file:///foo', () => {
      expect(new URI('file:///foo').resolve('bar').toString()).toBe('file:///foo/bar');
    });

    it('bar/baz to file:///foo', () => {
      expect(new URI('file:///foo').resolve('bar/baz').toString()).toBe('file:///foo/bar/baz');
    });

    it("'' to file:///", () => {
      const uri = new URI('file:///');
      expect(uri.resolve('').toString()).toBe(uri.toString());
    });

    it('bar to file:///', () => {
      expect(new URI('file:///').resolve('bar').toString()).toBe('file:///bar');
    });

    it('bar/baz to file:///', () => {
      expect(new URI('file:///').resolve('bar/baz').toString()).toBe('file:///bar/baz');
    });
  });

  describe('#path', () => {
    it('Should return with the FS path from the URI.', () => {
      expect(new URI('file:///foo/bar/baz.txt').path.toString()).toBe('/foo/bar/baz.txt');
    });

    it('Should not return the encoded path', () => {
      expect(new URI('file:///foo 3/bar 4/baz 4.txt').path.toString()).toBe('/foo 3/bar 4/baz 4.txt');
    });
  });

  describe('#withFragment', () => {
    it('Should replace the fragment.', () => {
      expect(new URI('file:///foo/bar/baz.txt#345345').withFragment('foo').toString()).toBe(
        'file:///foo/bar/baz.txt#foo',
      );
      expect(new URI('file:///foo/bar/baz.txt?foo=2#345345').withFragment('foo').toString(true)).toBe(
        'file:///foo/bar/baz.txt?foo=2#foo',
      );
    });

    it('Should remove the fragment.', () => {
      expect(new URI('file:///foo/bar/baz.txt#345345').withFragment('').toString()).toBe('file:///foo/bar/baz.txt');
    });
  });

  describe('#toString()', () => {
    it('should produce the non encoded string', () => {
      function check(uri: string): void {
        expect(new URI(uri).toString(true)).toBe(uri);
      }
      check('file:///X?test=32');
      check('file:///X?test=32#345');
      check('file:///X test/ddd?test=32#345');
    });
  });

  describe('#Uri.with...()', () => {
    it('produce proper URIs', () => {
      const uri = new URI('').withScheme('file').withPath('/foo/bar.txt').withQuery('x=12').withFragment('baz');
      expect(uri.toString(true)).toBe('file:///foo/bar.txt?x=12#baz');

      expect(uri.withScheme('http').toString(true)).toBe('http:/foo/bar.txt?x=12#baz');

      expect(uri.withoutQuery().toString(true)).toBe('file:///foo/bar.txt#baz');

      expect(uri.withoutFragment().toString(true)).toBe(uri.withFragment('').toString(true));

      expect(uri.withPath('hubba-bubba').toString(true)).toBe('file:///hubba-bubba?x=12#baz');
    });
  });

  describe('#relative()', () => {
    it('drive letters should be in lowercase', () => {
      const uri = new URI('file:///C:/projects/theia');
      const path = uri.relative(new URI(uri.resolve('node_modules/typescript/lib').toString()));
      expect(String(path)).toBe('node_modules/typescript/lib');
    });
  });

  describe('#isEqualOrParent()', () => {
    it('should return `true` for `uris` which are equal', () => {
      const a = new URI('file:///C:/projects/theia/foo/a.ts');
      const b = new URI('file:///C:/projects/theia/foo/a.ts');
      expect(a.isEqualOrParent(b)).toBe(true);
    });
    it('should return `false` for `uris` which are not equal', () => {
      const a = new URI('file:///C:/projects/theia/foo/a.ts');
      const b = new URI('file:///C:/projects/theia/foo/b.ts');
      expect(a.isEqualOrParent(b)).toBe(false);
    });

    it('should return `false` for `uris` which are not the same scheme', () => {
      const a = new URI('a:///C:/projects/theia/foo/a.ts');
      const b = new URI('b:///C:/projects/theia/foo/a.ts');
      expect(a.isEqualOrParent(b)).toBe(false);
    });

    it('should return `true` for parent paths', () => {
      const a = new URI('file:///C:/projects/'); // parent uri.
      const b = new URI('file:///C:/projects/theia/foo');
      expect(a.isEqualOrParent(b)).toBe(true);
    });
    it('should return `false` for non-parent paths', () => {
      const a = new URI('file:///C:/projects/a/'); // non-parent uri.
      const b = new URI('file:///C:/projects/theia/foo');
      expect(a.isEqualOrParent(b)).toBe(false);
    });
  });
});
