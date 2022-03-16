import { ILoggerManagerClient } from '@opensumi/ide-core-common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { GlobalBrowserStorageService } from '../../src/services';

describe('test for core-browser/src/services/storage-service.ts', () => {
  let injector: MockInjector;
  let browserStorageService: GlobalBrowserStorageService;
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: ILoggerManagerClient,
      useValue: {
        getLogger: jest.fn(),
      },
    });
    browserStorageService = injector.get<GlobalBrowserStorageService>(GlobalBrowserStorageService);
  });

  it('GlobalBrowserStorageService', () => {
    const key = 'test-key';
    expect(browserStorageService.getData(key)).toBeUndefined();
    expect(browserStorageService.getData(key, 'default-val')).toBe('default-val');

    expect(browserStorageService.setData(key, '123')).toBeUndefined();
    expect(browserStorageService.getData(key)).toBe('123');

    // same action like removeData
    expect(browserStorageService.setData(key)).toBeUndefined();
    expect(browserStorageService.getData(key)).toBeUndefined();

    expect(browserStorageService.setData(key, '456')).toBeUndefined();
    expect(browserStorageService.getData(key)).toBe('456');

    // real delete method
    expect(browserStorageService.removeData(key)).toBeUndefined();
    expect(browserStorageService.getData(key)).toBeUndefined();
  });
});
