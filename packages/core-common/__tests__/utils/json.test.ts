/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JSONArray, JSONUtils, JSONObject, JSONPrimitive } from '../../src/utils/json';


describe('JSONUtils', () => {

  describe('isPrimitive()', () => {

    it('should return `true` if the value is a primitive', () => {
      expect(JSONUtils.isPrimitive(null)).toBe(true);
      expect(JSONUtils.isPrimitive(false)).toBe(true);
      expect(JSONUtils.isPrimitive(true)).toBe(true);
      expect(JSONUtils.isPrimitive(1)).toBe(true);
      expect(JSONUtils.isPrimitive('1')).toBe(true);
    });

    it('should return `false` if the value is not a primitive', () => {
      expect(JSONUtils.isPrimitive([])).toBe(false);
      expect(JSONUtils.isPrimitive({})).toBe(false);
    });

  });

  describe('isArray()', () => {

    it('should test whether a JSON value is an array', () => {
      expect(JSONUtils.isArray([])).toBe(true);
      expect(JSONUtils.isArray(null)).toBe(false);
      expect(JSONUtils.isArray(1)).toBe(false);
    });

  });

  describe('isObject()', () => {

    it('should test whether a JSON value is an object', () => {
      expect(JSONUtils.isObject({ a: 1 })).toBe(true);
      expect(JSONUtils.isObject({})).toBe(true);
      expect(JSONUtils.isObject([])).toBe(false);
      expect(JSONUtils.isObject(1)).toBe(false);
    });
  });

  describe('deepEqual()', () => {

    it('should compare two JSON values for deep equality', () => {
      expect(JSONUtils.deepEqual([], [])).toBe(true);
      expect(JSONUtils.deepEqual([1], [1])).toBe(true);
      expect(JSONUtils.deepEqual({}, {})).toBe(true);
      expect(JSONUtils.deepEqual({ a: [] }, { a: [] })).toBe(true);
      expect(JSONUtils.deepEqual({ a: { b: null } }, { a: { b: null } })).toBe(true);
      expect(JSONUtils.deepEqual({ a: '1' }, { a: '1' })).toBe(true);
      expect(JSONUtils.deepEqual({ a: { b: null } }, { a: { b: '1' } })).toBe(false);
      expect(JSONUtils.deepEqual({ a: [] }, { a: [1] })).toBe(false);
      expect(JSONUtils.deepEqual([1], [1, 2])).toBe(false);
      expect(JSONUtils.deepEqual(null, [1, 2])).toBe(false);
      expect(JSONUtils.deepEqual([1], {})).toBe(false);
      expect(JSONUtils.deepEqual([1], [2])).toBe(false);
      expect(JSONUtils.deepEqual({}, { a: 1 })).toBe(false);
      expect(JSONUtils.deepEqual({ b: 1 }, { a: 1 })).toBe(false);
    });

  });

  describe('deepCopy()', () => {

    it('should deep copy an object', () => {
      let v1: JSONPrimitive = null;
      let v2: JSONPrimitive = true;
      let v3: JSONPrimitive = false;
      let v4: JSONPrimitive = 'foo';
      let v5: JSONPrimitive = 42;
      let v6: JSONArray = [1, 2, 3, [4, 5, 6], { a: 12, b: [4, 5] }, false];
      let v7: JSONObject = { a: false, b: [null, [1, 2]], c: { a: 1 } };
      let r1 = JSONUtils.deepCopy(v1);
      let r2 = JSONUtils.deepCopy(v2);
      let r3 = JSONUtils.deepCopy(v3);
      let r4 = JSONUtils.deepCopy(v4);
      let r5 = JSONUtils.deepCopy(v5);
      let r6 = JSONUtils.deepCopy(v6);
      let r7 = JSONUtils.deepCopy(v7);
      expect(v1).toBe(r1);
      expect(v2).toBe(r2);
      expect(v3).toBe(r3);
      expect(v4).toBe(r4);
      expect(v5).toBe(r5);
      expect(v6).toEqual(r6);
      expect(v7).toEqual(r7);
      expect(v6).not.toBe(r6);
      expect(v6[3]).not.toBe(r6[3]);
      expect(v6[4]).not.toBe(r6[4]);
      expect((v6[4] as JSONObject)['b']).not.toBe((r6[4] as JSONObject)['b']);
      expect(v7).not.toBe(r7);
      expect(v7['b']).not.toBe(r7['b']);
      expect((v7['b'] as JSONArray)[1]).not.toBe((r7['b'] as JSONArray)[1]);
      expect(v7['c']).not.toBe(r7['c']);
    });

  });

});
