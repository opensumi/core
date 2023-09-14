import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, CommandContribution, CommandRegistry, ComponentContribution, ComponentRegistry, Domain, MessageType, getExternalIcon } from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { IMessageService } from '@opensumi/ide-overlay';
import { ITerminalApiService } from '@opensumi/ide-terminal-next';

import { AiChatService } from '../../../src/browser/ai-chat/ai-chat.service';

import { MenuBarView } from './menu-bar.view';

@Injectable()
@Domain(ComponentContribution, MenuContribution, CommandContribution)
export class MenuBarContribution implements ComponentContribution, MenuContribution, CommandContribution {
  static MenuBarContainer = 'menubar';

  @Autowired(ITerminalApiService)
  private terminalApi: ITerminalApiService;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  @Autowired(AiChatService)
  protected readonly aiChatService: AiChatService;

  registerComponent(registry: ComponentRegistry): void {
    registry.register(MenuBarContribution.MenuBarContainer, {
      component: MenuBarView,
      id: MenuBarContribution.MenuBarContainer,
    });
  }

  registerCommands(commands: CommandRegistry): void {

    commands.registerCommand({
      id: 'ai.runAndDebug',
    }, {
      execute: async (text: string, isDebug: boolean) => {
      },
    });
  }

  registerMenus(menus: IMenuRegistry): void {
    let isShowMenuBar = true;

    menus.registerMenuItems(MenuId.IconMenubarContext, [
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getExternalIcon('layout-sidebar-left-off'),
        argsTransformer: (...args) => {
          isShowMenuBar = !isShowMenuBar;
          return [isShowMenuBar, 0];
        },
      },
    ]);
  }
}
