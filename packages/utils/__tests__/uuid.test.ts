/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { uuid } from '../src/uuid';

describe('UUID', () => {
  test('generation', () => {
    const uuid1 = uuid();
    const uuid2 = uuid();
    expect(uuid1 === uuid2).toBeFalsy();
    expect(typeof uuid1).toBe('string');
    expect(typeof uuid2).toBe('string');
  });
});
