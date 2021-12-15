/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as process from '../src/process';

describe('Process', () => {
  test('cwd', () => {
    expect(typeof process.cwd()).toBe('string');
  });

  test('env', () => {
    expect(typeof process.env).toBe('object');
  });

  test('platform', () => {
    expect(typeof process.platform).toBe('string');
  });

  test('nextTick', () => {
    expect(typeof process.nextTick).toBe('function');
  });
});
