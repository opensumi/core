import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import {
  AppConfig,
  ApplicationService,
  CorePreferences,
  EventBusImpl,
  IContextKeyService,
  PreferenceService,
} from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { MockLogger, MockLoggerManageClient, MockLoggerService } from '@opensumi/ide-core-browser/__mocks__/logger';
import { IMenuRegistry, MenuRegistryImpl } from '@opensumi/ide-core-browser/lib/menu/next';
import {
  CommandRegistry,
  CommandService,
  CoreCommandRegistryImpl,
  Disposable,
  IApplicationService,
  IEventBus,
  ILogServiceManager,
  ILogger,
  ILoggerManagerClient,
  OperatingSystem,
} from '@opensumi/ide-core-common';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IMessageService } from '@opensumi/ide-overlay';
import { EnvironmentVariableServiceToken } from '@opensumi/ide-terminal-next/lib/common/environmentVariable';
import { IThemeService } from '@opensumi/ide-theme';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';

import { createTerminalClientFactory2 } from '../../src/browser/terminal.client';
import { TerminalController } from '../../src/browser/terminal.controller';
import { TerminalInternalService } from '../../src/browser/terminal.internal.service';
import { TerminalNetworkService } from '../../src/browser/terminal.network';
import { TerminalPreference } from '../../src/browser/terminal.preference';
import { TerminalGroupViewService } from '../../src/browser/terminal.view';
import {
  ITerminalClientFactory2,
  ITerminalController,
  ITerminalErrorService,
  ITerminalGroupViewService,
  ITerminalInternalService,
  ITerminalNetwork,
  ITerminalProfileInternalService,
  ITerminalProfileService,
  ITerminalService,
  ITerminalServicePath,
  ITerminalTheme,
} from '../../src/common';
import { ITerminalPreference } from '../../src/common/preference';

import {
  MockEditorService,
  MockErrorService,
  MockFileService,
  MockMainLayoutService,
  MockPreferenceService,
  MockProfileService,
  MockTerminalProfileInternalService,
  MockTerminalService,
  MockTerminalThemeService,
  MockThemeService,
} from './mock.service';

const mockPreferences = new Map();
mockPreferences.set('terminal.integrated.shellArgs.linux', []);

export const injector = new MockInjector([
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
    useClass: MockTerminalService,
  },
  {
    token: IApplicationService,
    useClass: ApplicationService,
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
      mergedCollection: undefined,
      onDidChangeCollections: () => Disposable.NULL,
    },
  },
  {
    token: ITerminalProfileService,
    useValue: new MockProfileService(),
  },
  {
    token: ITerminalProfileInternalService,
    useValue: new MockTerminalProfileInternalService(),
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
      getOS() {
        return OperatingSystem.Macintosh;
      },
      detectAvailableProfiles() {
        return [];
      },
      create2: (sessionId, cols, rows, launchConfig) => ({
        pid: 0,
        name: '123',
      }),
      input() {
        // no-op for tests
      },
      resize() {
        // no-op for tests
      },
      $resolveUnixShellPath(p) {
        return p;
      },
    },
  },
  {
    token: WSChannelHandler,
    useValue: {
      clientId: 'test-window-client-id', // fake clientId for test case
    },
  },
  {
    token: CommandRegistry,
    useClass: CoreCommandRegistryImpl,
  },
  {
    token: IMenuRegistry,
    useClass: MenuRegistryImpl,
  },
  {
    token: ILoggerManagerClient,
    useClass: MockLoggerManageClient,
  },
  {
    token: ILogServiceManager,
    useClass: MockLoggerService,
  },
  {
    token: ILogger,
    useClass: MockLogger,
  },
]);
