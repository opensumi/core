import { Injectable } from '@opensumi/di';

import { createBrowserInjector } from '../src/injector-helper';
import { MockInjector, createNodeInjector } from '../src/mock-injector';

describe('mock-injector test', () => {
  let fn1: jest.Mock<any, any>;
  let fn2: jest.Mock<any, any>;

  @Injectable()
  class A {
    log = fn1;
  }

  beforeEach(() => {
    fn1 = jest.fn();
    fn2 = jest.fn();
  });

  describe('Manually create Injector', () => {
    let injector: MockInjector;

    beforeEach(() => {
      injector = new MockInjector();
    });

    it('Can mock a injected service', () => {
      injector.mock(A, 'log', fn2);

      const args = [1, '2', true];
      const a = injector.get(A);
      a.log(...args);

      expect(fn1).toHaveBeenCalledTimes(0);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledWith(...args);
    });

    it('Can mock a created service', () => {
      const args = [1, '2', true];
      const a = injector.get(A);

      injector.mock(A, 'log', fn2);
      a.log(...args);

      expect(fn1).toHaveBeenCalledTimes(0);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledWith(...args);
    });

    it('Work as expected', () => {
      const args = [1, '2', true];
      const a = injector.get(A);
      a.log(...args);

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn1).toHaveBeenCalledWith(...args);
    });
  });

  describe('User helper to create Injector', () => {
    it('Can mock service with the Injector created by `createBrowserInjector` method', () => {
      const injector = createBrowserInjector([]);
      injector.mock(A, 'log', fn2);

      const args = [1, '2', true];
      const a = injector.get(A);
      a.log(...args);

      expect(fn1).toHaveBeenCalledTimes(0);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledWith(...args);
    });

    it('Can mock service with the Injector created by `createNodeInjector` method', () => {
      const injector = createNodeInjector([]);
      injector.mock(A, 'log', fn2);

      const args = [1, '2', true];
      const a = injector.get(A);
      a.log(...args);

      expect(fn1).toHaveBeenCalledTimes(0);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledWith(...args);
    });
  });
});
