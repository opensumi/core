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
import { ExtensionWillContributeEvent } from '@opensumi/ide-extension/lib/browser/types';
import { ExtensionNodeServiceServerPath } from '@opensumi/ide-extension/lib/common';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { IJSONSchemaRegistry } from '@opensumi/ide-monaco';
import { ITextmateTokenizer, ITextmateTokenizerService } from '@opensumi/ide-monaco/lib/browser/contrib/tokenizer';
import { SchemaRegistry, SchemaStore } from '@opensumi/ide-monaco/lib/browser/schema-registry';
import { IIconService, IThemeService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';

import { MockPreferenceService } from '../../../terminal-next/__tests__/browser/mock.service';
import { MockExtNodeClientService } from '../../__mocks__/extension.service.client';
import { mockExtensionProps } from '../../__mocks__/extensions';
import { VSCodeContributesService, VSCodeContributesServiceToken } from '../../lib/browser/vscode/contributes';

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

  beforeAll((done) => {
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
    injector.overrideProviders({
      token: ExtensionNodeServiceServerPath,
      useClass: MockExtNodeClientService,
    });
    eventBus = injector.get(IEventBus);
    const contributes: VSCodeContributesService = injector.get(VSCodeContributesServiceToken);
    contributes.initialize();
    const lifecycleService: AppLifeCycleService = injector.get(AppLifeCycleServiceToken);
    lifecycleService.phase = LifeCyclePhase.Prepare;
    lifecycleService.phase = LifeCyclePhase.Initialize;
    lifecycleService.phase = LifeCyclePhase.Starting;
    lifecycleService.phase = LifeCyclePhase.Ready;
    textmateService = injector.get(ITextmateTokenizer);
    done();
  });

  it('ExtensionWillContributeEvent', (done) => {
    eventBus.on(ExtensionWillContributeEvent, (target) => {
      expect(target.payload.packageJSON.name).toBe(mockExtensionProps.packageJSON.name);
      done();
    });
  });

  it('register localization contribution', async () => {
    expect(process.env['TEST_KAITIAN_LANGUAGE_ID']?.toLowerCase()).toBe('zh-cn');
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
