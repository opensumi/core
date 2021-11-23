import * as monaco from '@ide-framework/monaco-editor-core/esm/vs/editor/editor.api';
import os from 'os';
import { Injector } from '@ide-framework/common-di';
import { VSCodeContributeRunner } from '../../src/browser/vscode/contributes';
import { IFileServiceClient } from '@ide-framework/ide-file-service/lib/common';
import { mockExtensionProps } from '../../__mocks__/extensions';
import { CommandRegistry, CommandService, CommandServiceImpl, EventBusImpl, IEventBus, ILogger, ILoggerManagerClient, Uri } from '@ide-framework/ide-core-common';
import { ExtensionWillContributeEvent } from '@ide-framework/ide-extension/lib/browser/types';
import { IJSONSchemaRegistry } from '@ide-framework/ide-monaco';
import { SchemaRegistry, SchemaStore } from '@ide-framework/ide-monaco/lib/browser/schema-registry';
import { IExtensionStoragePathServer } from '@ide-framework/ide-extension-storage';
import { ISchemaStore, PreferenceService } from '@ide-framework/ide-core-browser';
import { MockPreferenceService } from '../../../terminal-next/__tests__/browser/mock.service';
import { MockLogger, MockLoggerManageClient } from '@ide-framework/ide-core-browser/__mocks__/logger';
import { ExtensionNodeServiceServerPath } from '@ide-framework/ide-extension/lib/common';
import { MockExtNodeClientService } from '../../__mocks__/extension.service.client';
import { IIconService, IThemeService } from '@ide-framework/ide-theme';
import { IconService } from '@ide-framework/ide-theme/lib/browser';
import { WorkbenchThemeService } from '@ide-framework/ide-theme/lib/browser/workbench.theme.service';
import { ITextmateTokenizer } from '@ide-framework/ide-monaco/lib/browser/contrib/tokenizer';
import { MonacoService } from '@ide-framework/ide-core-browser/lib/monaco';
import { setupExtensionServiceInjector } from './extension-service/extension-service-mock-helper';
import { TextmateService } from '@ide-framework/ide-editor/lib/browser/monaco-contrib/tokenizer/textmate.service';

const extension = {
  ...mockExtensionProps,
  uri: Uri.file(mockExtensionProps.realPath),
  packageJSON: {
    ...mockExtensionProps.packageJSON,
    contributes: {
      localizations: [
        {
          'languageId': 'zh-cn',
          'languageName': 'Chinese Simplified',
          'localizedLanguageName': '中文（简体）',
          'translations': [
            {
              'id': 'vscode',
              'path': './translations/main.i18n.json',
            },
          ],
        },
      ],
      commands: [
        {
          command: 'test-command',
          title: '测试命令',
          category: 'Test',
        },
      ],
      themes: [
        {
          'id': 'ide-dark',
          'label': 'IDE Dark',
          'uiTheme': 'vs-dark',
          'path': './themes/dark/plus.json',
        },
      ],
      'languages': [
        {
          'id': 'javascript',
          'extensions': [
            '.js',
          ],
          'aliases': [
            'js',
            'JavaScript',
          ],
          'configuration': './language-configuration.json',
        },
      ],
    },
  },
};

describe('VSCodeContributeRunner', () => {
  let injector: Injector;
  let runner: VSCodeContributeRunner;
  let eventBus: IEventBus;

  beforeAll((done) => {
    injector = setupExtensionServiceInjector();
    injector.addProviders(...[
      {
        token: IEventBus,
        useClass: EventBusImpl,
      },
      {
        token: ISchemaStore,
        useClass: SchemaStore,
      },
      {
        token: IJSONSchemaRegistry,
        useClass: SchemaRegistry,
      },
      {
        token: ILoggerManagerClient,
        useClass: MockLoggerManageClient,
      },
      {
        token: MonacoService,
        useValue: {
          monacoLoaded: Promise.resolve(),
        },
      },
      {
        token: IFileServiceClient,
        useValue: {
          resolveContent: (uri) => ({
            content: '',
          }),
        },
      },
      {
        token: ILogger,
        useClass: MockLogger,
      },
      {
        token: ITextmateTokenizer,
        useClass: TextmateService,
      },
      {
        token: IIconService,
        useClass: IconService,
      },
      {
        token: IThemeService,
        useClass: WorkbenchThemeService,
      },
      {
        token: CommandService,
        useClass: CommandServiceImpl,
      },
      {
        token: PreferenceService,
        useValue: new MockPreferenceService(),
      },
      {
        token: IExtensionStoragePathServer,
        useValue: {
          getLastStoragePath() {
            return os.tmpdir();
          },
        },
      },
    ]);
    injector.overrideProviders({
      token: ExtensionNodeServiceServerPath,
      useClass: MockExtNodeClientService,
    });
    runner = injector.get(VSCodeContributeRunner, [extension]);
    eventBus = injector.get(IEventBus);
    done();
  });

  it('ExtensionWillContributeEvent', async (done) => {
    eventBus.on(ExtensionWillContributeEvent, (target) => {
      expect(target.payload.packageJSON.name).toBe(mockExtensionProps.packageJSON.name);
      done();
    });
    runner.run();
  });

  it('register localization contribution', async (done) => {
    await runner.run();
    expect(process.env['TEST_KAITIAN_LANGUAGE_ID']?.toLowerCase()).toBe('zh-cn');
    done();
  });

  it('register command contribution', async (done) => {
    const commandRegistry = injector.get(CommandRegistry);
    await runner.run();
    const command = commandRegistry.getCommand('test-command');
    expect(command).toBeDefined();
    expect(command?.label).toBe('测试命令');
    expect(command?.category).toBe('Test');
    done();
  });

  it('register theme contribution', async (done) => {
    await runner.run();
    const themeService = injector.get(IThemeService);
    const availableThemes = themeService.getAvailableThemeInfos();
    expect(availableThemes.length).toBe(1);
    done();
  });

  it('register language contribution', async (done) => {
    await runner.run();
    const languages = monaco.languages.getLanguages();
    expect(languages.map((l) => l.id)).toContain('javascript');
    done();
  });
});
