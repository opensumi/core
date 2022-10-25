import os from 'os';

import { Injector } from '@opensumi/di';
import { ISchemaStore, PreferenceService } from '@opensumi/ide-core-browser';
import {
  AppLifeCycleService,
  AppLifeCycleServiceToken,
  LifeCyclePhase,
} from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import {
  CommandRegistry,
  CommandService,
  CommandServiceImpl,
  EventBusImpl,
  IEventBus,
  Uri,
} from '@opensumi/ide-core-common';
import { TextmateService } from '@opensumi/ide-editor/lib/browser/monaco-contrib/tokenizer/textmate.service';
import { IExtensionStoragePathServer } from '@opensumi/ide-extension-storage';
import {
  AbstractExtInstanceManagementService,
  ExtensionWillContributeEvent,
} from '@opensumi/ide-extension/lib/browser/types';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { IJSONSchemaRegistry } from '@opensumi/ide-monaco';
import { ITextmateTokenizer, ITextmateTokenizerService } from '@opensumi/ide-monaco/lib/browser/contrib/tokenizer';
import { SchemaRegistry, SchemaStore } from '@opensumi/ide-monaco/lib/browser/schema-registry';
import { IIconService, IThemeService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';

import { MockPreferenceService } from '../../../terminal-next/__tests__/browser/mock.service';
import { mockExtensionProps } from '../../__mocks__/extensions';
import { VSCodeContributesService, VSCodeContributesServiceToken } from '../../src/browser/vscode/contributes';
import { ExtensionNodeServiceServerPath } from '../../src/common';

import { setupExtensionServiceInjector } from './extension-service/extension-service-mock-helper';

const extension = {
  ...mockExtensionProps,
  uri: Uri.file(mockExtensionProps.realPath),
  packageJSON: {
    ...mockExtensionProps.packageJSON,
    contributes: {
      localizations: [
        {
          languageId: 'zh-cn',
          languageName: 'Chinese Simplified',
          localizedLanguageName: '中文（简体）',
          translations: [
            {
              id: 'vscode',
              path: './translations/main.i18n.json',
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
          id: 'ide-dark',
          label: 'IDE Dark',
          uiTheme: 'vs-dark',
          path: './themes/dark/plus.json',
        },
      ],
      languages: [
        {
          id: 'javascript',
          extensions: ['.js'],
          aliases: ['js', 'JavaScript'],
          configuration: './language-configuration.json',
        },
      ],
    },
  },
};

describe('VSCodeContributeRunner', () => {
  let injector: Injector;
  let eventBus: IEventBus;
  let textmateService: ITextmateTokenizerService;
  let spyOnUpdateLanguagePack: jest.MockedFunction<any>;

  beforeAll(async () => {
    injector = setupExtensionServiceInjector();
    injector.addProviders(
      ...[
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
          token: IFileServiceClient,
          useValue: {
            resolveContent: (uri) => ({
              content: '',
            }),
          },
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
          token: AppLifeCycleServiceToken,
          useClass: AppLifeCycleService,
        },
        {
          token: IExtensionStoragePathServer,
          useValue: {
            getLastStoragePath() {
              return os.tmpdir();
            },
          },
        },
      ],
    );
    eventBus = injector.get(IEventBus);
    const contributes: VSCodeContributesService = injector.get(VSCodeContributesServiceToken);
    const extInstanceManagementService = injector.get(AbstractExtInstanceManagementService);
    extInstanceManagementService.getExtensionInstanceByExtId = () => extension;
    const extensionNodeService = injector.get(ExtensionNodeServiceServerPath);
    spyOnUpdateLanguagePack = jest.spyOn(extensionNodeService, 'updateLanguagePack');
    contributes.register(extension.id, extension.packageJSON.contributes);

    await contributes['runContributesByPhase'](LifeCyclePhase.Ready);
    textmateService = injector.get(ITextmateTokenizer);
  });

  it.skip('ExtensionWillContributeEvent', (done) => {
    eventBus.on(ExtensionWillContributeEvent, (target) => {
      expect(target.payload.packageJSON.name).toBe(mockExtensionProps.packageJSON.name);
      done();
    });
  });

  it('register localization contribution', async () => {
    expect(process.env['TEST_KAITIAN_LANGUAGE_ID']?.toLowerCase()).toBe('zh-cn');
    expect(spyOnUpdateLanguagePack).toBeCalledWith('zh-CN', extension.path, os.tmpdir());
  });

  it('register command contribution', async () => {
    const commandRegistry = injector.get(CommandRegistry);
    const command = commandRegistry.getCommand('test-command');
    expect(command).toBeDefined();
    expect(command?.label).toBe('测试命令');
    expect(command?.category).toBe('Test');
  });

  it('register theme contribution', async () => {
    const themeService = injector.get(IThemeService);
    const availableThemes = themeService.getAvailableThemeInfos();
    expect(availableThemes.length).toBe(1);
  });

  it('register language contribution', async () => {
    const languages = textmateService.getLanguages();
    expect(languages.map((l) => l.id)).toContain('javascript');
  });
});
