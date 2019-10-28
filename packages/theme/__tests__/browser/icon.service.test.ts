import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IconService } from '../../src/browser';
import { IIconService } from '../../src';
import { PreferenceSchemaProvider, IPreferenceSettingsService, ILoggerManagerClient, IFileServiceClient, URI } from '@ali/ide-core-browser';
import { MockPreferenceSchemaProvider, MockPreferenceSettingsService } from '@ali/ide-core-browser/lib/__mocks__/preference';
import { MockLoggerManageClient } from '@ali/ide-core-browser/lib/__mocks__/logger';
import { Injectable } from '@ali/common-di';
import { StaticResourceService } from '@ali/ide-static-resource/lib/browser';

@Injectable()
class MockFileServiceClient {
  resolveContent(uri: string) {
    if (uri.indexOf('font') > -1) {
      return `{
        "fonts": [
          {
            "id": "seti",
            "src": [
              {
                "path": "./seti.woff",
                "format": "woff"
              }
            ],
            "weight": "normal",
            "style": "normal",
            "size": "150%"
          }
        ],
        "iconDefinitions": {
          "_R_light": {
            "fontCharacter": "\\E001",
            "fontColor": "#498ba7"
          }
        },
        "file": "_R_light",
        "fileExtensions": {
          "bsl": "_R_light"
        },
        "fileNames": {
          "mix": "_R_light"
        },
        "languageIds": {
          "bat": "_R_light"
        },
        "light": {
          "file": "_R_light",
          "fileExtensions": {
            "r": "_R_light"
          },
          "languageIds": {
            "bat": "_R_light"
          },
          "fileNames": {
            "mix": "_R_light"
          }
        }
      }`;
    }
    return {
      content: `{
        "iconDefinitions": {
          "_root_folder_dark": {
            "iconPath": "./images/RootFolder_16x_inverse.svg"
          },
          "_root_folder_open_dark": {
            "iconPath": "./images/RootFolderOpen_16x_inverse.svg"
          },
          "_folder_dark": {
            "iconPath": "./images/Folder_16x_inverse.svg"
          },
          "_folder_open_dark": {
            "iconPath": "./images/FolderOpen_16x_inverse.svg"
          },
          "_file_dark": {
            "iconPath": "./images/Document_16x_inverse.svg"
          },
          "_root_folder": {
            "iconPath": "./images/RootFolder_16x.svg"
          },
          "_root_folder_open": {
            "iconPath": "./images/RootFolderOpen_16x.svg"
          },
          "_folder_light": {
            "iconPath": "./images/Folder_16x.svg"
          },
          "_folder_open_light": {
            "iconPath": "./images/FolderOpen_16x.svg"
          },
          "_file_light": {
            "iconPath": "./images/Document_16x.svg"
          }
        },
        "folderExpanded": "_folder_open_dark",
        "folder": "_folder_dark",
        "file": "_file_dark",
        "rootFolderExpanded": "_root_folder_open_dark",
        "rootFolder": "_root_folder_dark",
        "fileExtensions": {
          "js.map": "_file_dark"
        },
        "fileNames": {
          "readme.md": "_file_dark"
        },
        "languageIds": {
          "jsonc": "_file_dark"
        },
        "light": {
          "folderExpanded": "_folder_open_light",
          "folder": "_folder_light",
          "rootFolderExpanded": "_root_folder_open",
          "rootFolder": "_root_folder",
          "file": "_file_light",
          "fileExtensions": {
            "js.map": "_file_dark"
          },
          "fileNames": {
            "readme.md": "_file_dark"
          },
          "languageIds": {
            "jsonc": "_file_dark"
          }
        },
        "highContrast": {
          "folderExpanded": "_folder_open_light"
        }
      }`,
    };
  }
}

@Injectable()
class MockStaticResourceService {
  resolveStaticResource(uri: URI) {
    return uri.toString();
  }
}

describe('icon theme test', () => {
  let service: IconService;
  let injector: MockInjector;
  beforeAll(() => {
    injector = createBrowserInjector([]);

    injector.addProviders(
      {
        token: IIconService,
        useClass: IconService,
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
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
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
  });

  // @ts-ignore
  window.CSS = {
    escape: (str: string) => str,
  };

  it('should be able to register icon theme', () => {
    service = injector.get(IIconService);
    service.registerIconThemes([{
      id: 'test-icon-theme',
      label: 'Test IconTheme',
      uiTheme: 'vs',
      path: './test/path',
    }], 'file://mock/path');
    const infos = service.getAvailableThemeInfos();
    expect(infos.length).toEqual(1);
  });

  it('should be able to apply default & registed icon theme', async (done) => {
    const bodyNode = document.getElementsByTagName('body')[0];
    await service.applyTheme('error-icon-theme-id');
    expect(service.currentThemeId).not.toEqual('error-icon-theme-id');
    expect(bodyNode.classList.contains('default-file-icons')).toBeTruthy();
    await service.applyTheme('test-icon-theme');
    expect(service.currentThemeId).toEqual('test-icon-theme');
    expect(bodyNode.classList.contains('default-file-icons')).toBeFalsy();
    done();
  });

  it('current icon theme data should be correct', () => {
    const iconThemeNode = document.getElementById('icon-style');
    const currentTheme = service.currentTheme;
    expect(iconThemeNode).toBeDefined();
    expect(currentTheme).toBeDefined();
    expect(currentTheme.hasFileIcons).toBeTruthy();
    expect(currentTheme.hasFolderIcons).toBeTruthy();
    expect(currentTheme.hidesExplorerArrows).toBeFalsy();
    expect(currentTheme.styleSheetContent).toBeDefined();
    expect(iconThemeNode!.innerHTML.indexOf('file-icon')).toBeGreaterThan(-1);
  });

  it('should be able to generate iconClass from icon asset', () => {
    const iconClass = service.fromIcon('file:///mock/base/path', './testIcon.svg');
    expect(iconClass).toBeDefined();
    const extraIconNode = document.getElementById('plugin-icons');
    expect(extraIconNode).toBeDefined();
    expect(extraIconNode!.innerHTML.indexOf(iconClass!.replace(' mask-mode', ''))).toBeGreaterThan(-1);
    const multiIconClass = service.fromIcon('file:///mock/base/path', {
      dark: './testIcon.svg',
      light: './testIcon2.svg',
      hc: './testIcon3.svg',
    });
    expect(extraIconNode!.innerHTML.indexOf('.vs .' + multiIconClass!.replace(' mask-mode', ''))).toBeGreaterThan(-1);
  });

  it('should be able to load font icons', async (done) => {
    service.registerIconThemes([{
      id: 'test-font-icon-theme',
      label: 'Test IconTheme',
      uiTheme: 'vs',
      path: './test/font/path',
    }], 'file://mock/path');
    await service.applyTheme('test-font-icon-theme');
    expect(service.currentThemeId).toEqual('test-font-icon-theme');
    done();
  });
});
