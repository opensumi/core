import { Injector } from '@ali/common-di';
import { IEventBus, CommandService, ILogger, IFileServiceClient } from '@ali/ide-core-common';
import { AppConfig, IContextKeyService, PreferenceService, EventBusImpl } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-core-browser/lib/mocks/context-key';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IThemeService } from '@ali/ide-theme';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IWorkspaceService } from '@ali/ide-workspace';
import { TerminalController } from '../../src/browser/terminal.controller';
import { TerminalClientFactory } from '../../src/browser/terminal.client';
import { TerminalGroupViewService } from '../../src/browser/terminal.view';
import { TerminalInternalService } from '../../src/browser/terminal.service';
import { TerminalPreference } from '../../src/browser/terminal.preference';
import { ITerminalService, ITerminalPreference, ITerminalTheme, ITerminalClientFactory, ITerminalController, ITerminalGroupViewService, ITerminalInternalService, IWidget } from '../../src/common';
import {
  MockMainLayoutService,
  MockTerminalThemeService,
  MockSocketService,
  MockPreferenceService,
  MockThemeService,
  MockFileService,
  MockEditorService,
  MockWorkspaceService,
} from './mock.service';

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
    useValue: new MockWorkspaceService(),
  },
  {
    token: ITerminalGroupViewService,
    useClass: TerminalGroupViewService,
  },
  {
    token: ITerminalClientFactory,
    useFactory: (injector) => (widget: IWidget, options = {}, autofocus: boolean = false) => {
      return TerminalClientFactory.createClient(injector, widget, options, autofocus);
    },
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
    useValue: {},
  },
]);
