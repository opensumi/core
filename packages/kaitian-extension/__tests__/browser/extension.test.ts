import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { URI, Uri } from '@ali/ide-core-browser';
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
  packageJSON: {},
  extendConfig: {},
  extraMetadata: {},
  packageNlsJSON: {},
  defaultPkgNlsJSON: {},
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
