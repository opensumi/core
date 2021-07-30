import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { URI, Uri, registerLocalizationBundle, ILocalizationContents, setLanguageId } from '@ali/ide-core-browser';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IExtensionMetaData } from '../../src/common';
import * as paths from 'path';
import { ExtensionServiceImpl } from '../../src/browser/extension.service';
import { ExtensionService } from '../../src/common';
import { Extension } from '../../src/browser/extension';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';

const mockExtension: IExtensionMetaData = {
  id: 'test.kaitian-extension',
  path: paths.join(__dirname, '../__mock__/extension'),
  realPath: paths.join(__dirname, '../__mock__/extension'),
  uri: Uri.file(paths.join(__dirname, '../__mock__/extension')),
  extensionId: 'uuid-for-test-extension',
  isBuiltin: false,
  isDevelopment: false,
  packageJSON: {
    'displayName': '%displayName%',
  },
  extendConfig: {},
  extraMetadata: {},
  packageNlsJSON: {
    'displayName': '哈哈哈哈啊哈哈',
  },
  defaultPkgNlsJSON: {
    'displayName': 'ahhahahahahahah',
  },
};

describe(__filename, () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: ExtensionService,
        useClass: ExtensionServiceImpl,
      },
      {
        token: StaticResourceService,
        useValue: {
          resolveStaticResource(uri: URI) {
            return uri.withScheme('http').withAuthority('localhost');
          },
        },
      },
    );
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('should get correct extensionLocation for file scheme', async () => {
    const extension = injector.get(Extension, [
      mockExtension,
      true,
      true,
      false,
    ]);
    expect(extension.extensionLocation).toEqual(Uri.parse(`http://localhost${mockExtension.path}`));
  });

  it('should get nls value: 中文(中国)', async () => {
    const extension = injector.get(Extension, [
      mockExtension,
      true,
      true,
      false,
    ]);
    // 注入语言包前
    expect(extension.localize('displayName')).toEqual('%displayName%');

    registerLocalizationBundle({
      languageId: 'zh-CN',
      languageName: 'Chinese',
      localizedLanguageName: '中文(中国)',
      contents: extension.packageNlsJSON as ILocalizationContents,
    }, extension.id);

    // 注入语言包后
    setLanguageId('zh-CN');
    expect(extension.toJSON().displayName).toEqual('哈哈哈哈啊哈哈');
    expect(extension.localize('displayName')).toEqual('哈哈哈哈啊哈哈');
  });

  it('should get nls value: English', async () => {
    const extension = injector.get(Extension, [
      mockExtension,
      true,
      true,
      false,
    ]);

    registerLocalizationBundle({
      languageId: 'zh-CN',
      languageName: 'Chinese',
      localizedLanguageName: '中文(中国)',
      contents: extension.packageNlsJSON as ILocalizationContents,
    }, extension.id);

    registerLocalizationBundle({
      languageId: 'en',
      languageName: 'English',
      localizedLanguageName: 'English',
      contents: extension.defaultPkgNlsJSON as ILocalizationContents,
    }, extension.id);

    // 注入语言包后
    setLanguageId('en');
    expect(extension.toJSON().displayName).toEqual('ahhahahahahahah');
    expect(extension.localize('displayName')).toEqual('ahhahahahahahah');
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
