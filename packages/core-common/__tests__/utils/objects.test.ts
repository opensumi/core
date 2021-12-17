import * as objects from '../../src/utils/objects';

describe('Objects', () => {
  test('cloneAndChange', () => {
    const o1 = { something: 'hello' };
    const o = {
      o1,
      o2: o1,
    };
    expect(objects.cloneAndChange(o, () => {})).toEqual(o);
  });

  test('deepFreeze', (done) => {
    const o1 = { something: 'hello' };
    const o = {
      o1,
      o2: o1,
    };
    objects.deepFreeze(o);
    try {
      o.o1 = { something: 'world' };
    } catch (e) {
      done();
    }
  });

  test('deepClone', () => {
    const o1 = { something: 'hello' };
    const o = {
      o1,
      o2: o1,
    };
    const copy = objects.deepClone(o);
    o1.something = 'world';
    expect(copy.o1.something).toBe('hello');
  });

  test('isPlainObject', () => {
    let o = {};
    expect(objects.isPlainObject(o)).toBeTruthy();
    o = {
      o1: 'o1',
    };
    expect(objects.isPlainObject(o)).toBeTruthy();
  });

  test('removeUndefined', () => {
    const o1 = { something: 'hello' };
    const o = {
      o1,
      o2: undefined,
    };
    expect(objects.removeUndefined(o)).toEqual({
      o1,
    });
  });
});
