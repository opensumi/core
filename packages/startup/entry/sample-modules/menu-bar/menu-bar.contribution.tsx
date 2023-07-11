import React from 'react';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig, CommandContribution, CommandRegistry, ComponentContribution, ComponentRegistry, Domain, EDITOR_COMMANDS, MessageType, getExternalIcon, getIcon } from '@opensumi/ide-core-browser';

import { MenuBarView } from './menu-bar.view';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { ITaskService } from '@opensumi/ide-task';
import { ITerminalApiService } from '@opensumi/ide-terminal-next';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { IMessageService } from '@opensumi/ide-overlay';
import { AiChatService } from '../ai-chat/ai-chat.service';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

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
      id: 'ai.chat.explain.code',
      iconClass: getExternalIcon('comment-discussion'),
    }, {
      execute: async () => {
        await this.aiChatService.launchChatMessage('解释一下当前我选中的这段代码')
      }
    })

    commands.registerCommand({
      id: 'ai.runAndDebug',
    }, {
      execute: async (text: string, isDebug: boolean) => {
        let isNodeJs = false;
        if (!text) {
          const currentUri = this.editorService.currentEditor?.currentUri;
          isNodeJs = !!currentUri?.path.base.endsWith('.js');
          text = `${isNodeJs ? 'node' : 'node_modules/.bin/ts-node'} ${currentUri?.path.base}`
        }

        const terminal = await this.terminalApi.createTerminal({
          cwd: this.appConfig.workspaceDir,
          env: {
            PROMPT_COMMAND: ''
          }
        })

        const client = terminal.client;

        console.log('client', client)

        client.onOutput(async ({ data }) => {
          console.log('client.output:>>>> data', data)
          if (data.toString().includes('Error:')) {
            const btn = await this.messageService.open('程序运行出错了！问问 AI 助手吧～', MessageType.Warning, ['好啊'])

            if (btn === '好啊') {
              this.aiChatService.launchChatMessage(<div>
                运行代码出现这个错误:
                <SyntaxHighlighter language={'tsx'}>
                  {data}
                </SyntaxHighlighter>
              </div>)
              console.log('client.output:>>>> error data', data)
            }
          }
        });

        await client.attached.promise;

        setTimeout(async () => {
          await client.sendText(`${text} \n`)
        }, 1000)
      }
    })
  }

  registerMenus(menus: IMenuRegistry): void {
    let isShowMenuBar = true;

    menus.registerMenuItems(MenuId.IconMenubarContext, [
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getIcon('folder'),
        argsTransformer: (...args) => {
          isShowMenuBar = !isShowMenuBar
          return [isShowMenuBar, 0]
        },
      },
      {
        command: EDITOR_COMMANDS.SELECT_ALL.id,
        iconClass: getIcon('test')
      },
      {
        command: EDITOR_COMMANDS.UNDO.id,
        iconClass: getIcon('keyboard')
      },
    ])
  }
}
