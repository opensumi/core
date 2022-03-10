import { registerLocalizationBundle } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';

import { mockExtension } from '../../../__mocks__/extensions';
import { createBrowserApi } from '../../../src/browser/sumi-browser';

describe('activation event test', () => {
  let injector: MockInjector;
  let browserApi;

  beforeAll(() => {
    registerLocalizationBundle(
      {
        languageId: 'zh-CN',
        languageName: 'Chinese',
        localizedLanguageName: '中文(中国)',
        contents: {
          test: '测试',
          'test.format': '测试{0}',
        },
      },
      mockExtension.id,
    );
  });

  beforeEach(() => {
    injector = createBrowserInjector([]);

    browserApi = createBrowserApi(injector, mockExtension);
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('localize label', () => {
    expect(browserApi.localize('test')).toBe('测试');
  });

  it('localize format label', () => {
    expect(browserApi.formatLocalize('test.format', 'test')).toBe('测试test');
  });
});
