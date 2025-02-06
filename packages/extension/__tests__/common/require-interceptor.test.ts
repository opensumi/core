import React from 'react';

import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IRequireInterceptorService, RequireInterceptorService } from '../../src/common/require-interceptor';

describe('require-interceptor test', () => {
  const injector = new MockInjector();
  let requireInterceptorService: IRequireInterceptorService;

  beforeEach(() => {
    injector.addProviders({
      token: IRequireInterceptorService,
      useClass: RequireInterceptorService,
    });
    requireInterceptorService = injector.get(IRequireInterceptorService);
  });

  afterEach(async () => {
    await injector.disposeAll();
  });

  it('registerRequireInterceptor', () => {
    requireInterceptorService.registerRequireInterceptor({
      moduleName: 'react',
      load: () => React,
    });
    const interceptor = requireInterceptorService.getRequireInterceptor('react');
    const request = interceptor?.load({});
    expect(request).toMatchSnapshot();
  });
});
