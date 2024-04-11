import paths from 'path';

import { URI, Uri, getLanguageId, setLanguageId } from '@opensumi/ide-core-browser';
import { StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { Extension } from '../../src/browser/extension';
import { ExtensionServiceImpl } from '../../src/browser/extension.service';
import { IExtensionMetaData } from '../../src/common';
import { ExtensionService } from '../../src/common';

import '@opensumi/ide-i18n';

const mockExtension: IExtensionMetaData = {
  id: 'test.sumi-extension',
  path: paths.join(__dirname, '../../__mocks__/extension'),
  realPath: paths.join(__dirname, '../../__mocks__/extension'),
  uri: Uri.file(paths.join(__dirname, '../../__mocks__/extension')),
  extensionId: 'uuid-for-test-extension',
  isBuiltin: false,
  isDevelopment: false,
  packageJSON: {
    displayName: '%displayName%',
  },
  extendConfig: {},
  extraMetadata: {},
  packageNlsJSON: {
    displayName: '哈哈哈哈啊哈哈',
  },
  defaultPkgNlsJSON: {
    displayName: 'ahhahahahahahah',
  },
};

describe('extension browser test', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders({
      token: ExtensionService,
      useClass: ExtensionServiceImpl,
    });
    injector.overrideProviders({
      token: StaticResourceService,
      useValue: {
        resolveStaticResource(uri: URI) {
          return uri.withScheme('http').withAuthority('localhost');
        },
      },
    });
  });

  afterEach(async () => {
    await injector.disposeAll();
  });

  it('should get correct extensionLocation for file scheme', async () => {
    const extension = injector.get(Extension, [mockExtension, true, true, false]);
    expect(extension.extensionLocation).toEqual(Uri.parse(`http://localhost${mockExtension.path}`));
  });

  it('should get nls value: English (default)', async () => {
    const extension = injector.get(Extension, [mockExtension, true, true, false]);

    // contributeIfEnabled 中默认将 defaultPkgNlsJson 设置为名为 default 的语言
    // 但是以前的逻辑是默认认为语言为 zh-CN
    // 就不该动老逻辑了，这里手动设置个语言
    setLanguageId('lang not exists');
    setTimeout(() => {
      expect(getLanguageId()).toBe('lang not exists');
      const localizedDisplayName = extension.localize('displayName');
      expect(localizedDisplayName).toEqual('%displayName%');

      extension.enable();
      extension.initialize();

      // 注入语言包后
      expect(extension.toJSON().displayName).toEqual('ahhahahahahahah');
      expect(extension.localize('displayName')).toEqual('ahhahahahahahah');
    }, 0);
  });

  it('should get nls value: 中文(中国)', async () => {
    const extension = injector.get(Extension, [mockExtension, true, true, false]);
    setLanguageId('zh-CN');
    setTimeout(() => {
      extension.enable();
      extension.initialize();

      // 注入语言包后
      expect(extension.toJSON().displayName).toEqual('中文测试');
      expect(extension.localize('displayName')).toEqual('中文测试');
    }, 0);
  });

  it('should get correct extensionLocation for custom scheme', async () => {
    const extension = injector.get(Extension, [
      { ...mockExtension, uri: Uri.parse(`kt-ext://cdn${mockExtension.path}`) },
      true,
      true,
      false,
    ]);
    expect(extension.extensionLocation).toEqual(Uri.parse(`http://localhost${mockExtension.path}`));
  });
});
