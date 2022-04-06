// copied from https://github.com/microsoft/vscode/blob/master/src/vs/base/test/common/map.test.ts
// converted by [jest-codemods](https://github.com/skovhus/jest-codemods)

/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vscode-uri';

import { IteratorResult } from '../src/iterator';
import {
  ResourceMap,
  TernarySearchTree,
  PathIterator,
  StringIterator,
  LinkedMap,
  Touch,
  LRUCache,
  mapToSerializable,
  serializableToMap,
  SetMap,
} from '../src/map';

function assertDeepStrictEqual(a, b) {
  expect(a).toEqual(b);
}

describe('Map', () => {
  test('LinkedMap - Simple', () => {
    const map = new LinkedMap<string, string>();
    map.set('ak', 'av');
    map.set('bk', 'bv');
    assertDeepStrictEqual(map.keys(), ['ak', 'bk']);
    assertDeepStrictEqual(map.values(), ['av', 'bv']);
  });

  test('LinkedMap - Touch Old one', () => {
    const map = new LinkedMap<string, string>();
    map.set('ak', 'av');
    map.set('ak', 'av', Touch.AsOld);
    assertDeepStrictEqual(map.keys(), ['ak']);
    assertDeepStrictEqual(map.values(), ['av']);
  });

  test('LinkedMap - Touch New one', () => {
    const map = new LinkedMap<string, string>();
    map.set('ak', 'av');
    map.set('ak', 'av', Touch.AsNew);
    assertDeepStrictEqual(map.keys(), ['ak']);
    assertDeepStrictEqual(map.values(), ['av']);
  });

  test('LinkedMap - Touch Old two', () => {
    const map = new LinkedMap<string, string>();
    map.set('ak', 'av');
    map.set('bk', 'bv');
    map.set('bk', 'bv', Touch.AsOld);
    assertDeepStrictEqual(map.keys(), ['bk', 'ak']);
    assertDeepStrictEqual(map.values(), ['bv', 'av']);
  });

  test('LinkedMap - Touch New two', () => {
    const map = new LinkedMap<string, string>();
    map.set('ak', 'av');
    map.set('bk', 'bv');
    map.set('ak', 'av', Touch.AsNew);
    assertDeepStrictEqual(map.keys(), ['bk', 'ak']);
    assertDeepStrictEqual(map.values(), ['bv', 'av']);
  });

  test('LinkedMap - Touch Old from middle', () => {
    const map = new LinkedMap<string, string>();
    map.set('ak', 'av');
    map.set('bk', 'bv');
    map.set('ck', 'cv');
    map.set('bk', 'bv', Touch.AsOld);
    assertDeepStrictEqual(map.keys(), ['bk', 'ak', 'ck']);
    assertDeepStrictEqual(map.values(), ['bv', 'av', 'cv']);
  });

  test('LinkedMap - Touch New from middle', () => {
    const map = new LinkedMap<string, string>();
    map.set('ak', 'av');
    map.set('bk', 'bv');
    map.set('ck', 'cv');
    map.set('bk', 'bv', Touch.AsNew);
    assertDeepStrictEqual(map.keys(), ['ak', 'ck', 'bk']);
    assertDeepStrictEqual(map.values(), ['av', 'cv', 'bv']);
  });

  test('LinkedMap - basics', () => {
    const map = new LinkedMap<string, any>();

    expect(map.size).toEqual(0);

    map.set('1', 1);
    map.set('2', '2');
    map.set('3', true);

    const obj = Object.create(null);
    map.set('4', obj);

    const date = Date.now();
    map.set('5', date);

    expect(map.size).toEqual(5);
    expect(map.get('1')).toEqual(1);
    expect(map.get('2')).toEqual('2');
    expect(map.get('3')).toEqual(true);
    expect(map.get('4')).toEqual(obj);
    expect(map.get('5')).toEqual(date);
    expect(!map.get('6')).toBeTruthy();

    map.delete('6');
    expect(map.size).toEqual(5);
    expect(map.delete('1')).toEqual(true);
    expect(map.delete('2')).toEqual(true);
    expect(map.delete('3')).toEqual(true);
    expect(map.delete('4')).toEqual(true);
    expect(map.delete('5')).toEqual(true);

    expect(map.size).toEqual(0);
    expect(!map.get('5')).toBeTruthy();
    expect(!map.get('4')).toBeTruthy();
    expect(!map.get('3')).toBeTruthy();
    expect(!map.get('2')).toBeTruthy();
    expect(!map.get('1')).toBeTruthy();

    map.set('1', 1);
    map.set('2', '2');
    map.set('3', true);

    expect(map.has('1')).toBeTruthy();
    expect(map.get('1')).toEqual(1);
    expect(map.get('2')).toEqual('2');
    expect(map.get('3')).toEqual(true);

    map.clear();

    expect(map.size).toEqual(0);
    expect(!map.get('1')).toBeTruthy();
    expect(!map.get('2')).toBeTruthy();
    expect(!map.get('3')).toBeTruthy();
    expect(!map.has('1')).toBeTruthy();
  });

  test('LinkedMap - LRU Cache simple', () => {
    const cache = new LRUCache<number, number>(5);

    [1, 2, 3, 4, 5].forEach((value) => cache.set(value, value));
    expect(cache.size).toBe(5);
    cache.set(6, 6);
    expect(cache.size).toBe(5);
    assertDeepStrictEqual(cache.keys(), [2, 3, 4, 5, 6]);
    cache.set(7, 7);
    expect(cache.size).toBe(5);
    assertDeepStrictEqual(cache.keys(), [3, 4, 5, 6, 7]);
    const values: number[] = [];
    [3, 4, 5, 6, 7].forEach((key) => values.push(cache.get(key)!));
    assertDeepStrictEqual(values, [3, 4, 5, 6, 7]);
  });

  test('LinkedMap - LRU Cache get', () => {
    const cache = new LRUCache<number, number>(5);

    [1, 2, 3, 4, 5].forEach((value) => cache.set(value, value));
    expect(cache.size).toBe(5);
    assertDeepStrictEqual(cache.keys(), [1, 2, 3, 4, 5]);
    cache.get(3);
    assertDeepStrictEqual(cache.keys(), [1, 2, 4, 5, 3]);
    cache.peek(4);
    assertDeepStrictEqual(cache.keys(), [1, 2, 4, 5, 3]);
    const values: number[] = [];
    [1, 2, 3, 4, 5].forEach((key) => values.push(cache.get(key)!));
    assertDeepStrictEqual(values, [1, 2, 3, 4, 5]);
  });

  test('LinkedMap - LRU Cache limit', () => {
    const cache = new LRUCache<number, number>(10);

    for (let i = 1; i <= 10; i++) {
      cache.set(i, i);
    }
    expect(cache.size).toBe(10);
    cache.limit = 5;
    expect(cache.size).toBe(5);
    assertDeepStrictEqual(cache.keys(), [6, 7, 8, 9, 10]);
    cache.limit = 20;
    expect(cache.size).toBe(5);
    for (let i = 11; i <= 20; i++) {
      cache.set(i, i);
    }
    expect(cache.size).toEqual(15);
    const values: number[] = [];
    for (let i = 6; i <= 20; i++) {
      values.push(cache.get(i)!);
      expect(cache.get(i)).toBe(i);
    }
    assertDeepStrictEqual(cache.values(), values);
  });

  test('LinkedMap - LRU Cache limit with ratio', () => {
    const cache = new LRUCache<number, number>(10, 0.5);

    for (let i = 1; i <= 10; i++) {
      cache.set(i, i);
    }
    expect(cache.size).toBe(10);
    cache.set(11, 11);
    expect(cache.size).toBe(5);
    assertDeepStrictEqual(cache.keys(), [7, 8, 9, 10, 11]);
    const values: number[] = [];
    cache.keys().forEach((key) => values.push(cache.get(key)!));
    assertDeepStrictEqual(values, [7, 8, 9, 10, 11]);
    assertDeepStrictEqual(cache.values(), values);
  });

  test('LinkedMap - toJSON / fromJSON', () => {
    let map = new LinkedMap<string, string>();
    map.set('ak', 'av');
    map.set('bk', 'bv');
    map.set('ck', 'cv');

    const json = map.toJSON();
    map = new LinkedMap<string, string>();
    map.fromJSON(json);

    let i = 0;
    map.forEach((value, key) => {
      if (i === 0) {
        expect(key).toEqual('ak');
        expect(value).toEqual('av');
      } else if (i === 1) {
        expect(key).toEqual('bk');
        expect(value).toEqual('bv');
      } else if (i === 2) {
        expect(key).toEqual('ck');
        expect(value).toEqual('cv');
      }

      i++;
    });
  });

  test('LinkedMap - delete Head and Tail', () => {
    const map = new LinkedMap<string, number>();

    expect(map.size).toEqual(0);

    map.set('1', 1);
    expect(map.size).toEqual(1);
    map.delete('1');
    expect(map.get('1')).toEqual(undefined);
    expect(map.size).toEqual(0);
    expect(map.keys().length).toEqual(0);
  });

  test('LinkedMap - delete Head', () => {
    const map = new LinkedMap<string, number>();

    expect(map.size).toEqual(0);

    map.set('1', 1);
    map.set('2', 2);
    expect(map.size).toEqual(2);
    map.delete('1');
    expect(map.get('2')).toEqual(2);
    expect(map.size).toEqual(1);
    expect(map.keys().length).toEqual(1);
    expect(map.keys()[0]).toEqual('2');
  });

  test('LinkedMap - delete Tail', () => {
    const map = new LinkedMap<string, number>();

    expect(map.size).toEqual(0);

    map.set('1', 1);
    map.set('2', 2);
    expect(map.size).toEqual(2);
    map.delete('2');
    expect(map.get('1')).toEqual(1);
    expect(map.size).toEqual(1);
    expect(map.keys().length).toEqual(1);
    expect(map.keys()[0]).toEqual('1');
  });

  test('SetMap - add unique value', () => {
    const value1 = 1;
    const value2 = 2;
    const value3 = 1;
    const value4 = 997;
    const key = 'key';
    const setMap = new SetMap<string, number>();
    setMap.add(key, value1);
    setMap.add(key, value2);
    setMap.add(key, value3);
    setMap.add(key, value4);
    let sum1 = 0;
    setMap.forEach(key, (value) => {
      sum1 += value;
    });
    expect(sum1).toEqual(1000);
    setMap.delete(key, value4);
    let sum2 = 0;
    setMap.forEach(key, (value) => {
      sum2 += value;
    });
    expect(sum2).toEqual(3);
  });

  test('PathIterator', () => {
    const iter = new PathIterator();
    iter.reset('file:///usr/bin/file.txt');

    expect(iter.value()).toEqual('file:');
    expect(iter.hasNext()).toEqual(true);
    expect(iter.cmp('file:')).toEqual(0);
    expect(iter.cmp('a') < 0).toBeTruthy();
    expect(iter.cmp('aile:') < 0).toBeTruthy();
    expect(iter.cmp('z') > 0).toBeTruthy();
    expect(iter.cmp('zile:') > 0).toBeTruthy();

    iter.next();
    expect(iter.value()).toEqual('usr');
    expect(iter.hasNext()).toEqual(true);

    iter.next();
    expect(iter.value()).toEqual('bin');
    expect(iter.hasNext()).toEqual(true);

    iter.next();
    expect(iter.value()).toEqual('file.txt');
    expect(iter.hasNext()).toEqual(false);

    iter.next();
    expect(iter.value()).toEqual('');
    expect(iter.hasNext()).toEqual(false);
    iter.next();
    expect(iter.value()).toEqual('');
    expect(iter.hasNext()).toEqual(false);

    //
    iter.reset('/foo/bar/');
    expect(iter.value()).toEqual('foo');
    expect(iter.hasNext()).toEqual(true);

    iter.next();
    expect(iter.value()).toEqual('bar');
    expect(iter.hasNext()).toEqual(false);
  });

  function deepStrictEqual<E>(trie: TernarySearchTree<E>, ...elements: [string, E][]) {
    const map = new Map<string, E>();
    for (const [key, value] of elements) {
      map.set(key, value);
    }
    map.forEach((value, key) => {
      expect(trie.get(key)).toEqual(value);
    });
    trie.forEach((element, key) => {
      expect(element).toEqual(map.get(key));
      map.delete(key);
    });
    expect(map.size).toEqual(0);
  }

  test('TernarySearchTree - set', () => {
    let trie = TernarySearchTree.forStrings<number>();
    trie.set('foobar', 1);
    trie.set('foobaz', 2);

    deepStrictEqual(trie, ['foobar', 1], ['foobaz', 2]); // longer

    trie = TernarySearchTree.forStrings<number>();
    trie.set('foobar', 1);
    trie.set('fooba', 2);
    deepStrictEqual(trie, ['foobar', 1], ['fooba', 2]); // shorter

    trie = TernarySearchTree.forStrings<number>();
    trie.set('foo', 1);
    trie.set('foo', 2);
    deepStrictEqual(trie, ['foo', 2]);

    trie = TernarySearchTree.forStrings<number>();
    trie.set('foo', 1);
    trie.set('foobar', 2);
    trie.set('bar', 3);
    trie.set('foob', 4);
    trie.set('bazz', 5);

    deepStrictEqual(trie, ['foo', 1], ['foobar', 2], ['bar', 3], ['foob', 4], ['bazz', 5]);
  });

  test('TernarySearchTree - findLongestMatch', () => {
    const trie = TernarySearchTree.forStrings<number>();
    trie.set('foo', 1);
    trie.set('foobar', 2);
    trie.set('foobaz', 3);

    expect(trie.findSubstr('f')).toEqual(undefined);
    expect(trie.findSubstr('z')).toEqual(undefined);
    expect(trie.findSubstr('foo')).toEqual(1);
    expect(trie.findSubstr('fooö')).toEqual(1);
    expect(trie.findSubstr('fooba')).toEqual(1);
    expect(trie.findSubstr('foobarr')).toEqual(2);
    expect(trie.findSubstr('foobazrr')).toEqual(3);
  });

  test('TernarySearchTree - basics', () => {
    const trie = new TernarySearchTree<number>(new StringIterator());

    trie.set('foo', 1);
    trie.set('bar', 2);
    trie.set('foobar', 3);

    expect(trie.get('foo')).toEqual(1);
    expect(trie.get('bar')).toEqual(2);
    expect(trie.get('foobar')).toEqual(3);
    expect(trie.get('foobaz')).toEqual(undefined);
    expect(trie.get('foobarr')).toEqual(undefined);

    expect(trie.findSubstr('fo')).toEqual(undefined);
    expect(trie.findSubstr('foo')).toEqual(1);
    expect(trie.findSubstr('foooo')).toEqual(1);

    trie.delete('foobar');
    trie.delete('bar');
    expect(trie.get('foobar')).toEqual(undefined);
    expect(trie.get('bar')).toEqual(undefined);

    trie.set('foobar', 17);
    trie.set('barr', 18);
    expect(trie.get('foobar')).toEqual(17);
    expect(trie.get('barr')).toEqual(18);
    expect(trie.get('bar')).toEqual(undefined);
  });

  test('TernarySearchTree - delete & cleanup', () => {
    const trie = new TernarySearchTree<number>(new StringIterator());
    trie.set('foo', 1);
    trie.set('foobar', 2);
    trie.set('bar', 3);

    trie.delete('foo');
    trie.delete('foobar');
  });

  test('TernarySearchTree (PathSegments) - basics', () => {
    const trie = new TernarySearchTree<number>(new PathIterator());

    trie.set('/user/foo/bar', 1);
    trie.set('/user/foo', 2);
    trie.set('/user/foo/flip/flop', 3);

    expect(trie.get('/user/foo/bar')).toEqual(1);
    expect(trie.get('/user/foo')).toEqual(2);
    expect(trie.get('/user//foo')).toEqual(2);
    expect(trie.get('/user\\foo')).toEqual(2);
    expect(trie.get('/user/foo/flip/flop')).toEqual(3);

    expect(trie.findSubstr('/user/bar')).toEqual(undefined);
    expect(trie.findSubstr('/user/foo')).toEqual(2);
    expect(trie.findSubstr('\\user\\foo')).toEqual(2);
    expect(trie.findSubstr('/user//foo')).toEqual(2);
    expect(trie.findSubstr('/user/foo/ba')).toEqual(2);
    expect(trie.findSubstr('/user/foo/far/boo')).toEqual(2);
    expect(trie.findSubstr('/user/foo/bar')).toEqual(1);
    expect(trie.findSubstr('/user/foo/bar/far/boo')).toEqual(1);
  });

  test('TernarySearchTree (PathSegments) - lookup', () => {
    const map = new TernarySearchTree<number>(new PathIterator());
    map.set('/user/foo/bar', 1);
    map.set('/user/foo', 2);
    map.set('/user/foo/flip/flop', 3);

    expect(map.get('/foo')).toEqual(undefined);
    expect(map.get('/user')).toEqual(undefined);
    expect(map.get('/user/foo')).toEqual(2);
    expect(map.get('/user/foo/bar')).toEqual(1);
    expect(map.get('/user/foo/bar/boo')).toEqual(undefined);
  });

  test('TernarySearchTree (PathSegments) - superstr', () => {
    const map = new TernarySearchTree<number>(new PathIterator());
    map.set('/user/foo/bar', 1);
    map.set('/user/foo', 2);
    map.set('/user/foo/flip/flop', 3);
    map.set('/usr/foo', 4);

    let item: IteratorResult<number>;
    let iter = map.findSuperstr('/user');

    item = iter!.next();
    expect(item.value).toEqual(2);
    expect(item.done).toEqual(false);
    item = iter!.next();
    expect(item.value).toEqual(1);
    expect(item.done).toEqual(false);
    item = iter!.next();
    expect(item.value).toEqual(3);
    expect(item.done).toEqual(false);
    item = iter!.next();
    expect(item.value).toEqual(undefined);
    expect(item.done).toEqual(true);

    iter = map.findSuperstr('/usr');
    item = iter!.next();
    expect(item.value).toEqual(4);
    expect(item.done).toEqual(false);

    item = iter!.next();
    expect(item.value).toEqual(undefined);
    expect(item.done).toEqual(true);

    expect(map.findSuperstr('/not')).toEqual(undefined);
    expect(map.findSuperstr('/us')).toEqual(undefined);
    expect(map.findSuperstr('/usrr')).toEqual(undefined);
    expect(map.findSuperstr('/userr')).toEqual(undefined);
  });

  test('ResourceMap - basics', () => {
    const map = new ResourceMap<any>();

    const resource1 = URI.parse('some://1');
    const resource2 = URI.parse('some://2');
    const resource3 = URI.parse('some://3');
    const resource4 = URI.parse('some://4');
    const resource5 = URI.parse('some://5');
    const resource6 = URI.parse('some://6');

    expect(map.size).toEqual(0);

    map.set(resource1, 1);
    map.set(resource2, '2');
    map.set(resource3, true);

    const values = map.values();
    expect(values[0]).toEqual(1);
    expect(values[1]).toEqual('2');
    expect(values[2]).toEqual(true);

    let counter = 0;
    map.forEach((value) => {
      expect(value).toEqual(values[counter++]);
    });

    const obj = Object.create(null);
    map.set(resource4, obj);

    const date = Date.now();
    map.set(resource5, date);

    expect(map.size).toEqual(5);
    expect(map.get(resource1)).toEqual(1);
    expect(map.get(resource2)).toEqual('2');
    expect(map.get(resource3)).toEqual(true);
    expect(map.get(resource4)).toEqual(obj);
    expect(map.get(resource5)).toEqual(date);
    expect(!map.get(resource6)).toBeTruthy();

    map.delete(resource6);
    expect(map.size).toEqual(5);
    expect(map.delete(resource1)).toBeTruthy();
    expect(map.delete(resource2)).toBeTruthy();
    expect(map.delete(resource3)).toBeTruthy();
    expect(map.delete(resource4)).toBeTruthy();
    expect(map.delete(resource5)).toBeTruthy();

    expect(map.size).toEqual(0);
    expect(!map.get(resource5)).toBeTruthy();
    expect(!map.get(resource4)).toBeTruthy();
    expect(!map.get(resource3)).toBeTruthy();
    expect(!map.get(resource2)).toBeTruthy();
    expect(!map.get(resource1)).toBeTruthy();

    map.set(resource1, 1);
    map.set(resource2, '2');
    map.set(resource3, true);

    expect(map.has(resource1)).toBeTruthy();
    expect(map.get(resource1)).toEqual(1);
    expect(map.get(resource2)).toEqual('2');
    expect(map.get(resource3)).toEqual(true);

    map.clear();

    expect(map.size).toEqual(0);
    expect(!map.get(resource1)).toBeTruthy();
    expect(!map.get(resource2)).toBeTruthy();
    expect(!map.get(resource3)).toBeTruthy();
    expect(!map.has(resource1)).toBeTruthy();

    map.set(resource1, false);
    map.set(resource2, 0);

    expect(map.has(resource1)).toBeTruthy();
    expect(map.has(resource2)).toBeTruthy();
  });

  test('ResourceMap - files (do NOT ignorecase)', () => {
    const map = new ResourceMap<any>();

    const fileA = URI.parse('file://some/filea');
    const fileB = URI.parse('some://some/other/fileb');
    const fileAUpper = URI.parse('file://SOME/FILEA');

    map.set(fileA, 'true');
    expect(map.get(fileA)).toEqual('true');

    expect(!map.get(fileAUpper)).toBeTruthy();

    expect(!map.get(fileB)).toBeTruthy();

    map.set(fileAUpper, 'false');
    expect(map.get(fileAUpper)).toEqual('false');

    expect(map.get(fileA)).toEqual('true');

    const windowsFile = URI.file('c:\\test with %25\\c#code');
    const uncFile = URI.file('\\\\shäres\\path\\c#\\plugin.json');

    map.set(windowsFile, 'true');
    map.set(uncFile, 'true');

    expect(map.get(windowsFile)).toEqual('true');
    expect(map.get(uncFile)).toEqual('true');
  });

  // test('ResourceMap - files (ignorecase)', function () {
  // 	const map = new ResourceMap<any>(true);

  // 	const fileA = URI.parse('file://some/filea');
  // 	const fileB = URI.parse('some://some/other/fileb');
  // 	const fileAUpper = URI.parse('file://SOME/FILEA');

  // 	map.set(fileA, 'true');
  // 	assert.equal(map.get(fileA), 'true');

  // 	assert.equal(map.get(fileAUpper), 'true');

  // 	assert.ok(!map.get(fileB));

  // 	map.set(fileAUpper, 'false');
  // 	assert.equal(map.get(fileAUpper), 'false');

  // 	assert.equal(map.get(fileA), 'false');

  // 	const windowsFile = URI.file('c:\\test with %25\\c#code');
  // 	const uncFile = URI.file('\\\\shäres\\path\\c#\\plugin.json');

  // 	map.set(windowsFile, 'true');
  // 	map.set(uncFile, 'true');

  // 	assert.equal(map.get(windowsFile), 'true');
  // 	assert.equal(map.get(uncFile), 'true');
  // });

  test('mapToSerializable / serializableToMap', () => {
    const map = new Map<string, string | null>();
    map.set('1', 'foo');
    map.set('2', null);
    map.set('3', 'bar');

    const map2 = serializableToMap(mapToSerializable(map));
    expect(map2.size).toEqual(map.size);
    expect(map2.get('1')).toEqual(map.get('1'));
    expect(map2.get('2')).toEqual(map.get('2'));
    expect(map2.get('3')).toEqual(map.get('3'));
  });
});
