import * as objects from '../../src/utils/objects';

describe('Objects', () => {

	test('cloneAndChange', () => {
		let o1 = { something: 'hello' };
		let o = {
			o1: o1,
			o2: o1
		};
		expect(objects.cloneAndChange(o, () => { })).toEqual(o);
	});

  test('deepFreeze', (done) => {
		let o1 = { something: 'hello' };
		let o = {
			o1: o1,
			o2: o1
		};
    objects.deepFreeze(o);
    try {
      o.o1 = { something: 'world' };
    } catch (e) {
      done();
    }
	});

  test('deepClone', () => {
		let o1 = { something: 'hello' };
		let o = {
			o1: o1,
			o2: o1
		};
    const copy = objects.deepClone(o);
    o1.something = 'world';
		expect(copy.o1.something).toBe('hello');
	});

  test('isPlainObject', () => {
		let o = {};
		expect(objects.isPlainObject(o)).toBeTruthy();
    o = {
      o1: 'o1'
    };
    expect(objects.isPlainObject(o)).toBeTruthy();
	});

  test('removeUndefined', () => {
		let o1 = { something: 'hello' };
		let o = {
			o1: o1,
			o2: undefined
		};
		expect(objects.removeUndefined(o)).toEqual({
      o1,
    });
	});

});