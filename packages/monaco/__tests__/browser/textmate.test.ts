import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MonacoService, ServiceNames } from '../../src/common';
import MonacoServiceImpl from '../../src/browser/monaco.service';
import { MockedStandaloneCodeEditor } from '../../src/__mocks__/monaco/editor/code-editor';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { TextmateService } from '../../src/browser/textmate.service';
import { Injectable } from '@ali/common-di';
import { IFileServiceClient } from '@ali/ide-file-service';
import { ActivationEventService } from '@ali/ide-activation-event';
import { ActivationEventServiceImpl } from '@ali/ide-activation-event/lib/browser/activation.service';

@Injectable()
class MockFileServiceClient {
  resolveContent(uri: string) {
    if (uri.indexOf('configuration') > -1) {
      return {
        content: `{
          "comments": {
            "blockComment": [ "<!--", "-->" ]
          },
          "brackets": [
            ["<!--", "-->"],
            ["<", ">"],
            ["{", "}"],
            ["(", ")"]
          ],
          "autoClosingPairs": [
            { "open": "{", "close": "}"},
            { "open": "[", "close": "]"},
            { "open": "(", "close": ")" },
            { "open": "'", "close": "'" },
            { "open": "<!--", "close": "-->", "notIn": [ "comment", "string" ]}
          ],
          "surroundingPairs": [
            { "open": "'", "close": "'" },
            { "open": "{", "close": "}"},
            { "open": "[", "close": "]"},
            { "open": "(", "close": ")" },
            { "open": "<", "close": ">" }
          ]
        }`,
      };
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

let injector: MockInjector;

describe('textmate service test', () => {

  injector = createBrowserInjector([]);
  (global as any).amdLoader = {require: null};
  let monacoService: MonacoService;
  let textmateService: TextmateService;

  injector.addProviders(
    {
      token: MonacoService,
      useClass: MonacoServiceImpl,
    },
    {
      token: TextmateService,
      useClass: TextmateService,
    },
    {
      token: IFileServiceClient,
      useClass: MockFileServiceClient,
    },
    {
      token: ActivationEventService,
      useClass: ActivationEventServiceImpl,
    },
  );

  (global as any).amdLoader = {require: null};

  it('should be able to load monaco', async (done) => {
    monacoService = injector.get(MonacoService);
    await monacoService.loadMonaco();
    done();
  });

  it('should be able to register language', async (done) => {
    textmateService = injector.get(TextmateService);
    textmateService.registerLanguage({
      id: 'html',
      extensions: [
        '.html',
        '.htm',
      ],
      aliases: [
        'HTML',
      ],
      mimetypes: [
        'text/html',
      ],
      configuration: './language-configuration.json',
    }, 'file:///mock/base');
    const activationService: ActivationEventService = injector.get(ActivationEventService);
    activationService.onEvent('onLanguage:html', () => done());
  });

  it('on language event should be fired', () => {
    // TODO
  });

  it('should be able to register grammar with or without languageId', () => {
    textmateService.registerGrammar({
      'language': 'html',
      'scopeName': 'text.html.derivative',
      'path': './syntaxes/html-derivative.tmLanguage.json',
      'embeddedLanguages': {
        'text.html': 'html',
        'source.css': 'css',
        'source.js': 'javascript',
        'source.python': 'python',
        'source.smarty': 'smarty',
      },
      'tokenTypes': {
        'meta.tag string.quoted': 'other',
      },
    }, 'file:///mock/extpath');
    textmateService.registerGrammar({
      'scopeName': 'text.html.basic',
      'path': './syntaxes/html.tmLanguage.json',
      'embeddedLanguages': {
        'text.html': 'html',
        'source.css': 'css',
        'source.js': 'javascript',
        'source.python': 'python',
        'source.smarty': 'smarty',
      },
      'tokenTypes': {
        'meta.tag string.quoted': 'other',
      },
    }, 'file:///mock/extpath');
  });

  it('grammar registry should init correctly after grammars registed', () => {
    textmateService.init();
  });

});
