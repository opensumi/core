import { ServiceRegistry, getServiceMethods } from '@opensumi/ide-connection/src/common/rpc-service/registry';
import { Deferred } from '@opensumi/ide-core-common';

describe('registry should work', () => {
  it('can register method properly', async () => {
    const registry = new ServiceRegistry();

    const updateDerfered = new Deferred<string[]>();

    registry.onServicesUpdate((services) => {
      updateDerfered.resolve(services);
    });

    const fnA = jest.fn();
    registry.register('a', (...args) => {
      fnA(...args);
    });

    registry.invoke('a');

    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnA).toHaveBeenCalledWith();

    registry.invoke('a', 1, 2, 3);
    expect(fnA).toHaveBeenCalledTimes(2);
    expect(fnA).toHaveBeenCalledWith(1, 2, 3);

    expect(await updateDerfered.promise).toEqual(['a']);
  });

  it('can register service properly', async () => {
    const registry = new ServiceRegistry();

    const simpleObj = {
      method: jest.fn(),
      __func: jest.fn(),
      d: jest.fn(),
    };

    const updateDerfered = new Deferred<string[]>();

    registry.onServicesUpdate((services) => {
      updateDerfered.resolve(services);
    });

    registry.registerService(simpleObj);

    registry.invoke('method', 1, 2, 3);

    expect(simpleObj.method).toHaveBeenCalledTimes(1);
    expect(simpleObj.method).toHaveBeenCalledWith(1, 2, 3);

    expect(await updateDerfered.promise).toMatchInlineSnapshot(`
      [
        "__defineGetter__",
        "__defineSetter__",
        "__func",
        "__lookupGetter__",
        "__lookupSetter__",
        "d",
        "hasOwnProperty",
        "isPrototypeOf",
        "method",
        "propertyIsEnumerable",
        "toLocaleString",
        "toString",
        "valueOf",
      ]
    `);
  });

  it('can register service with name converter properly', async () => {
    const registry = new ServiceRegistry();

    const simpleObj = {
      method: jest.fn(),
      __func: jest.fn(),
      d: jest.fn(),
    };

    const updateDerfered = new Deferred<string[]>();

    registry.onServicesUpdate((services) => {
      updateDerfered.resolve(services);
    });

    registry.registerService(simpleObj, {
      nameConverter: (str) => str.toUpperCase(),
    });

    registry.invoke('METHOD', 1, 2, 3);

    expect(simpleObj.method).toHaveBeenCalledTimes(1);
    expect(simpleObj.method).toHaveBeenCalledWith(1, 2, 3);

    expect(await updateDerfered.promise).toMatchInlineSnapshot(`
      [
        "__DEFINEGETTER__",
        "__DEFINESETTER__",
        "__FUNC",
        "__LOOKUPGETTER__",
        "__LOOKUPSETTER__",
        "D",
        "HASOWNPROPERTY",
        "ISPROTOTYPEOF",
        "METHOD",
        "PROPERTYISENUMERABLE",
        "TOLOCALESTRING",
        "TOSTRING",
        "VALUEOF",
      ]
    `);
  });

  it('can get service methods properly', () => {
    const methods = getServiceMethods(new A());
    expect(methods).toMatchInlineSnapshot(`
      [
        "__defineGetter__",
        "__defineSetter__",
        "__func",
        "__lookupGetter__",
        "__lookupSetter__",
        "d",
        "hasOwnProperty",
        "isPrototypeOf",
        "method",
        "propertyIsEnumerable",
        "toLocaleString",
        "toString",
        "valueOf",
      ]
    `);

    const transpiledA = createTranspiledA();
    expect(getServiceMethods(transpiledA)).toMatchInlineSnapshot(`
      [
        "__defineGetter__",
        "__defineSetter__",
        "__func",
        "__lookupGetter__",
        "__lookupSetter__",
        "d",
        "hasOwnProperty",
        "isPrototypeOf",
        "method",
        "propertyIsEnumerable",
        "toLocaleString",
        "toString",
        "valueOf",
      ]
    `);

    expect(getServiceMethods(simpleObj)).toMatchInlineSnapshot(`
      [
        "__defineGetter__",
        "__defineSetter__",
        "__func",
        "__lookupGetter__",
        "__lookupSetter__",
        "d",
        "hasOwnProperty",
        "isPrototypeOf",
        "method",
        "propertyIsEnumerable",
        "toLocaleString",
        "toString",
        "valueOf",
      ]
    `);
  });
});

class A {
  method() {}
  __func() {}
  d = () => {};
}

const simpleObj = {
  method() {},
  __func() {},
  d: () => {},
};

/**
 * Transpiled version of class A (use babel)
 */
function createTranspiledA() {
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError('Cannot call a class as a function');
    }
  }
  function _defineProperties(target, props) {
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < props.length; i++) {
      const descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ('value' in descriptor) {
        descriptor.writable = true;
      }
      Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
    }
  }
  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) {
      _defineProperties(Constructor.prototype, protoProps);
    }
    if (staticProps) {
      _defineProperties(Constructor, staticProps);
    }
    Object.defineProperty(Constructor, 'prototype', { writable: false });
    return Constructor;
  }
  function _defineProperty(obj, key, value) {
    key = _toPropertyKey(key);
    if (key in obj) {
      Object.defineProperty(obj, key, { value, enumerable: true, configurable: true, writable: true });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  function _toPropertyKey(t) {
    const i = _toPrimitive(t, 'string');
    return 'symbol' == typeof i ? i : i + '';
  }
  function _toPrimitive(t, r) {
    if ('object' != typeof t || !t) {
      return t;
    }
    const e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      const i = e.call(t, r || 'default');
      if ('object' != typeof i) {
        return i;
      }
      throw new TypeError('@@toPrimitive must return a primitive value.');
    }
    return ('string' === r ? String : Number)(t);
  }
  const A = /* #__PURE__*/ (function () {
    function A() {
      // @ts-expect-error: transpiled by babel
      _classCallCheck(this, A);
      // @ts-expect-error: transpiled by babel
      _defineProperty(this, 'd', function () {});
    }
    // @ts-expect-error: transpiled by babel
    return _createClass(A, [
      {
        key: 'method',
        value: function method() {},
      },
      {
        key: '__func',
        value: function __func() {},
      },
    ]);
  })();

  return new A();
}
