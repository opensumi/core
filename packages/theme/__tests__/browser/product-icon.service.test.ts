import { Injectable } from '@opensumi/di';
import { IPreferenceSettingsService, PreferenceSchemaProvider, URI } from '@opensumi/ide-core-browser';
import {
  MockPreferenceSchemaProvider,
  MockPreferenceSettingsService,
} from '@opensumi/ide-core-browser/__mocks__/preference';
import { StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { getIconRegistry } from '../../lib/common/icon-registry';
import { IProductIconService } from '../../src';
import { ProductIconService } from '../../src/browser';
import { DEFAULT_PRODUCT_ICON_THEME_ID } from '../../src/common';

@Injectable()
class MockFileServiceClient {
  readFile(uri: string) {
    return {
      content: `{
        "fonts": [
          {
            "id": "test-product-icon-id",
            "src": [
              {
                "path": "./test.woff",
                "format": "woff"
              }
            ],
            "weight": "normal",
            "style": "normal"
          }
        ],
        "iconDefinitions": {
          "explorer-view-icon": {
            "fontCharacter": "e001"
          },
          "sumi-embed": {
            "fontCharacter": "e002"
          },
          "search": { "fontCharacter": "🔎" },
          "extensions": { "fontCharacter": "e003" }
        }
      }`,
    };
  }
}

@Injectable()
class MockStaticResourceService {
  resolveStaticResource(uri: URI) {
    return uri.withScheme('file');
  }
}

describe('product icon theme test', () => {
  let service: ProductIconService;
  let injector: MockInjector;
  beforeAll(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: IProductIconService,
        useClass: ProductIconService,
      },
      {
        token: PreferenceSchemaProvider,
        useClass: MockPreferenceSchemaProvider,
      },
      {
        token: IPreferenceSettingsService,
        useClass: MockPreferenceSettingsService,
      },
      {
        token: IFileServiceClient,
        useClass: MockFileServiceClient,
      },
      {
        token: StaticResourceService,
        useClass: MockStaticResourceService,
      },
    );
    service = injector.get(IProductIconService);
  });

  it('should be able to register product icon theme', () => {
    service.registerProductIconThemes(
      [
        {
          id: 'test-product-icon-theme',
          label: 'Test ProductIconTheme',
          path: './test/path',
          extensionId: 'mock',
        },
      ],
      new URI('file://mock/path'),
    );
    const infos = service.getAvailableThemeInfos();
    expect(infos.length).toEqual(2);
  });

  it('should be able to apply default product icon theme', async () => {
    await service.applyTheme(DEFAULT_PRODUCT_ICON_THEME_ID);
    const productIconThemeNode = document.getElementById('product-icon-style')!;
    const codiconsNode = document.getElementById('codiconStyles')!;
    expect(productIconThemeNode).toBeTruthy();
    expect(codiconsNode).toBeTruthy();
  });

  it('should be able to apply & register product icon theme', async () => {
    service.registerProductIconThemes(
      [
        {
          id: 'test-product-icon-theme',
          label: 'Test ProductIconTheme',
          path: './test/path',
          extensionId: 'mock',
        },
      ],
      new URI('file://mock/path'),
    );
    await service.applyTheme('test-product-icon-theme');
    expect(service.currentThemeId).toEqual('test-product-icon-theme');

    const codiconNode = document.getElementById('codiconStyles')!;
    const productIconNode = document.getElementById('product-icon-style')!;
    const codiconArray = codiconNode.innerHTML.split('\n');
    expect(codiconArray[codiconArray.length - 1]).toContain("font-family: 'pi-test-product-icon-id'");

    const productIconArray = productIconNode.innerHTML.split('\n');
    expect(productIconArray.length).toBe(5);
    expect(productIconArray[3]).toBe(
      ".kticon-embed:before { content: 'e002'; font-family: 'pi-test-product-icon-id'; }",
    );
  });

  it('should be able to register icons use iconRegistry', async () => {
    const iconRegistry = getIconRegistry();

    iconRegistry.registerIcon('test-codicon', {
      fontCharacter: '\\e001',
    });

    iconRegistry.registerSumiIcon('test-sumiicon', {
      fontCharacter: '\\e002',
    });

    expect(iconRegistry.getIcon('test-codicon')).toBeDefined();
    expect(iconRegistry.getSumiIcon('test-sumiicon')).toBeDefined();

    iconRegistry.deregisterIcon('test-codicon');
    expect(iconRegistry.getIcon('test-codicon')).toBeUndefined();
  });
});
