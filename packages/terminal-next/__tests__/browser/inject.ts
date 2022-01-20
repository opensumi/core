import { Injector } from '@opensumi/di';
import { IEventBus, CommandService, ILogger, IFileServiceClient, Disposable } from '@opensumi/ide-core-common';
import {
  AppConfig,
  IContextKeyService,
  PreferenceService,
  EventBusImpl,
  CorePreferences,
} from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IThemeService } from '@opensumi/ide-theme';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { TerminalController } from '../../src/browser/terminal.controller';
import { createTerminalClientFactory, createTerminalClientFactory2 } from '../../src/browser/terminal.client';
import { TerminalGroupViewService } from '../../src/browser/terminal.view';
import { TerminalInternalService } from '../../src/browser/terminal.internal.service';
import { TerminalPreference } from '../../src/browser/terminal.preference';
import { TerminalNetworkService } from '../../src/browser/terminal.network';
import {
  ITerminalService,
  ITerminalTheme,
  ITerminalClientFactory,
  ITerminalClientFactory2,
  ITerminalController,
  ITerminalGroupViewService,
  ITerminalInternalService,
  ITerminalNetwork,
  ITerminalErrorService,
  ITerminalProfileService,
  ITerminalServicePath,
} from '../../src/common';
import { ITerminalPreference } from '../../src/common/preference';
import {
  MockMainLayoutService,
  MockTerminalThemeService,
  MockSocketService,
  MockPreferenceService,
  MockThemeService,
  MockFileService,
  MockEditorService,
  MockErrorService,
  MockProfileService,
} from './mock.service';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';
import { EnvironmentVariableServiceToken } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';
import { MockLogger } from '@opensumi/ide-core-browser/__mocks__/logger';
import { IMessageService } from '@opensumi/ide-overlay';
import { TerminalProfileService } from '../../lib/browser/terminal.profile';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';

const mockPreferences = new Map();
mockPreferences.set('terminal.integrated.shellArgs.linux', []);

export const injector = new Injector([
  {
    token: ITerminalInternalService,
    useClass: TerminalInternalService,
  },
  {
    token: ITerminalController,
    useClass: TerminalController,
  },
  {
    token: ITerminalPreference,
    useClass: TerminalPreference,
  },
  {
    token: IEventBus,
    useValue: new EventBusImpl(),
  },
  {
    token: ITerminalService,
    useValue: new MockSocketService(),
  },
  {
    token: IContextKeyService,
    useValue: new MockContextKeyService(),
  },
  {
    token: ITerminalTheme,
    useValue: new MockTerminalThemeService(),
  },
  {
    token: IMainLayoutService,
    useValue: new MockMainLayoutService(),
  },
  {
    token: PreferenceService,
    useValue: new MockPreferenceService(),
  },
  {
    token: IThemeService,
    useValue: new MockThemeService(),
  },
  {
    token: WorkbenchEditorService,
    useValue: new MockEditorService(),
  },
  {
    token: IFileServiceClient,
    useValue: new MockFileService(),
  },
  {
    token: IWorkspaceService,
    useClass: MockWorkspaceService,
  },
  {
    token: ITerminalGroupViewService,
    useClass: TerminalGroupViewService,
  },
  {
    token: CorePreferences,
    useValue: mockPreferences,
  },
  {
    token: ITerminalClientFactory,
    useFactory: createTerminalClientFactory,
  },
  {
    token: ITerminalClientFactory2,
    useFactory: createTerminalClientFactory2,
  },
  {
    token: CommandService,
    useValue: {},
  },
  {
    token: AppConfig,
    useValue: {},
  },
  {
    token: ILogger,
    useClass: MockLogger,
  },
  {
    token: IMessageService,
    useValue: {
      error: jest.fn(),
    },
  },
  {
    token: ITerminalNetwork,
    useClass: TerminalNetworkService,
  },
  {
    token: ITerminalErrorService,
    useValue: new MockErrorService(),
  },
  {
    token: EnvironmentVariableServiceToken,
    useValue: {
      onDidChangeCollections: () => Disposable.create(() => {}),
    },
  },
  {
    token: ITerminalProfileService,
    useValue: new MockProfileService(),
  },
  {
    token: ITerminalServicePath,
    useValue: {
      getCodePlatformKey() {
        return 'osx';
      },
      getDefaultSystemShell() {
        return '/bin/sh';
      },
      getOs() {
        return OperatingSystem.Macintosh;
      },
      detectAvailableProfiles() {
        return [];
      },
      create2: (sessionId, cols, rows, launchConfig) => ({
        pid: 0,
        name: '123',
      }),
      $resolveUnixShellPath(p) {
        return p;
      },
      $resolvePotentialUnixShellPath() {
        return 'detectedBash';
      },
    },
  },
]);
