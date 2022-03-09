import { OS } from '@opensumi/ide-core-common';

import { MergedEnvironmentVariableCollection } from '../../src/common/environmentVariableCollection';

describe('MergedEnvironmentVariableCollection', () => {
  const mockCollection1 = new Map();
  const mockMap1 = new Map();
  mockMap1.set('VARIABLE1-1', { value: 'value1-1', type: 1 });
  mockMap1.set('VARIABLE1-2', { value: 'value1-2', type: 2 });
  mockMap1.set('VARIABLE1-3', { value: 'value1-3', type: 3 });
  mockCollection1.set('extension-env-collection', {
    persistent: true,
    map: mockMap1,
  });

  const colleciton1 = new MergedEnvironmentVariableCollection(mockCollection1);

  it('MergedEnvironmentVariableCollection#applyToProcessEnvironment', async (done) => {
    const env = {};
    await colleciton1.applyToProcessEnvironment(env, OS.Type.Linux, (val) => Promise.resolve(val));
    expect(env).toEqual({
      'VARIABLE1-1': 'value1-1',
      'VARIABLE1-2': 'value1-2',
      'VARIABLE1-3': 'value1-3',
    });
    done();
  });

  it('MergedEnvironmentVariableCollection#diff#1', () => {
    const mockCollection2 = new Map();
    const mockMap2 = new Map();
    mockMap2.set('VARIABLE1-1', { value: 'value1-1-2', type: 1 });
    mockCollection2.set('extension-env-collection', {
      persistent: true,
      map: mockMap2,
    });

    const colleciton2 = new MergedEnvironmentVariableCollection(mockCollection2);
    const diff = colleciton1.diff(colleciton2);
    /**
     * {
     *  added: Map {},
     *  changed: Map { 'VARIABLE1-1' => [ [Object] ] },
     *  removed: Map { 'VARIABLE1-2' => [ [Object] ], 'VARIABLE1-3' => [ [Object] ] }
     * }
     */
    expect(diff?.added.size).toBe(0);
    expect(diff?.changed.size).toBe(1);
    expect(diff?.removed.size).toBe(2);
    expect(diff?.changed.has('VARIABLE1-1')).toBeTruthy();
    expect(diff?.changed.get('VARIABLE1-1')![0].extensionIdentifier).toBe('extension-env-collection');
    expect(diff?.changed.get('VARIABLE1-1')![0].value).toBe('value1-1-2');
    expect(diff?.changed.get('VARIABLE1-1')![0].type).toBe(1);
    expect(diff?.removed.has('VARIABLE1-2')).toBeTruthy();
    expect(diff?.removed.has('VARIABLE1-3')).toBeTruthy();
  });

  it('MergedEnvironmentVariableCollection#2', () => {
    const mockCollection3 = new Map();
    const mockMap3 = new Map();
    mockMap3.set('VARIABLE2-1', { value: 'value2-1', type: 1 });
    mockMap3.set('VARIABLE2-1', { value: 'value2-1', type: 1 });
    mockMap3.set('VARIABLE2-1', { value: 'value2-1', type: 1 });
    mockCollection3.set('extension-env-collection', {
      persistent: true,
      map: mockMap3,
    });

    const colleciton3 = new MergedEnvironmentVariableCollection(mockCollection3);
    const diff = colleciton1.diff(colleciton3);
    /**
     * {
     *  added: Map { 'VARIABLE2-1' => [ [Object] ] },
     *  changed: Map {},
     *  removed: Map {
     *    'VARIABLE1-1' => [ [Object] ],
     *    'VARIABLE1-2' => [ [Object] ],
     *    'VARIABLE1-3' => [ [Object] ]
     *  }
     * }
     */
    expect(diff?.added.size).toBe(1);
    expect(diff?.changed.size).toBe(0);
    expect(diff?.removed.size).toBe(3);

    expect(diff?.added.get('VARIABLE2-1')).toBeTruthy();
    expect(diff?.added.get('VARIABLE2-1')![0]).toBeDefined();
    expect(diff?.added.get('VARIABLE2-1')![0].extensionIdentifier).toBe('extension-env-collection');
    expect(diff?.added.get('VARIABLE2-1')![0].value).toBe('value2-1');
    expect(diff?.added.get('VARIABLE2-1')![0].type).toBe(1);

    expect(diff?.removed.get('VARIABLE1-1')).toBeTruthy();
    expect(diff?.removed.get('VARIABLE1-1')![0]).toBeDefined();
    expect(diff?.removed.get('VARIABLE1-1')![0].extensionIdentifier).toBe('extension-env-collection');
    expect(diff?.removed.get('VARIABLE1-1')![0].value).toBe('value1-1');
  });
});
