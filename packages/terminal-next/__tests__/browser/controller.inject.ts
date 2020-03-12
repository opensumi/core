import { Injector } from '@ali/common-di';
import { IEventBus, CommandService, ILogger, IFileServiceClient } from '@ali/ide-core-common';
import { AppConfig, IContextKeyService, PreferenceService, EventBusImpl } from '@ali/ide-core-browser';
import { MockContextKeyService } from '@ali/ide-core-browser/lib/mocks/context-key';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IThemeService } from '@ali/ide-theme';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IWorkspaceService } from '@ali/ide-workspace';
import { TerminalController } from '../../src/browser/terminal.controller';
import { ITerminalExternalService } from '../../src/common';
import { ITerminalTheme } from '../../src/browser/terminal.theme';
import {
  MockMainLayoutService,
  MockTerminalThemeService,
  MockSocketService,
  MockPreferenceService,
  MockThemeService,
  MockFileService,
  MockEditorService,
  MockWorkspaceService,
  MockTerminalWidget,
} from './mock.service';
import { TerminalClient } from '../../lib/browser/terminal.client';

export function createTerminalController() {
  const injector = new Injector([
    {
      token: IEventBus,
      useValue: new EventBusImpl(),
    },
    {
      token: ITerminalExternalService,
      useValue: new MockSocketService(),
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
      token: ILogger,
      useValue: {},
    },
    {
      token: IThemeService,
      useValue: new MockThemeService(),
    },
    {
      token: WorkbenchEditorService,
      useValue: {},
    },
    {
      token: IFileServiceClient,
      useValue: {},
    },
    {
      token: IWorkspaceService,
      useValue: {},
    },
  ]);

  const controller = injector.get(TerminalController);
  return controller;
}

export function createClient(controller?: TerminalController) {
  const client = new TerminalClient(
    new MockSocketService(),
    // @ts-ignore
    new MockWorkspaceService(),
    // @ts-ignore
    new MockEditorService(),
    // @ts-ignore
    new MockFileService(),
    // @ts-ignore
    new MockThemeService(),
    // @ts-ignore
    new MockPreferenceService(),
    // @ts-ignore
    controller || {},
    // @ts-ignore
    new MockTerminalWidget(),
  );

  return client;
}
