import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { AppConfig, CommandContribution, CommandRegistry, ComponentContribution, ComponentRegistry, Domain, IQuickOpenHandlerRegistry, Position, QUICK_OPEN_COMMANDS, URI, getIcon, IRange } from '@opensumi/ide-core-browser';
import { QuickOpenContribution } from '@opensumi/ide-core-browser';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IEditor } from '@opensumi/ide-editor';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { ResourceService } from '@opensumi/ide-editor';
import { IResource } from '@opensumi/ide-editor';
import { BrowserEditorContribution, IEditorDocumentModelContentRegistry, IEditorFeatureRegistry } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IFileTreeAPI } from '@opensumi/ide-file-tree-next';

import { AiChatService } from './ai-chat.service';
import { AiChatView } from './ai-chat.view';
import { AiEditorContribution } from './ai-editor.contribution';
import { AiQuickCommandHandler } from './ai-quick-open.command';
import { AiDiffDocumentProvider } from './diff-widget/ai-diff-document.provider';
import { AI_EXPLAIN_TERMINAL_COMMANDS } from '../../common/command';
import { ITerminalController, ITerminalGroupViewService } from '@opensumi/ide-terminal-next';
// import { TerminalClient } from '@opensumi/ide-terminal-next/lib/browser/terminal.client';

@Injectable()
@Domain(ComponentContribution, QuickOpenContribution, BrowserEditorContribution, MenuContribution, CommandContribution)
export class AiChatContribution implements ComponentContribution, QuickOpenContribution, BrowserEditorContribution, MenuContribution, CommandContribution {

  static AiChatContainer = 'ai-chat';

  @Autowired()
  private readonly aiDiffDocumentProvider: AiDiffDocumentProvider;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IFileTreeAPI)
  private readonly fileTreeAPI: IFileTreeAPI;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  @Autowired(AiChatService)
  protected readonly aiChatService: AiChatService;

  @Autowired()
  private readonly aiQuickCommandHandler: AiQuickCommandHandler;

  @Autowired(ITerminalGroupViewService)
  protected readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalController)
  protected readonly terminalController: ITerminalController;

  onStart() {
    // console.log('terminalClient:>>>', this.terminalClient)
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(AiChatContribution.AiChatContainer, {
      component: AiChatView,
      id: AiChatContribution.AiChatContainer
    }, {
      containerId: AiChatContribution.AiChatContainer,
    });
  }

  registerQuickOpenHandlers(handlers: IQuickOpenHandlerRegistry): void {
    handlers.registerHandler(this.aiQuickCommandHandler, {
      title: 'AI 助手',
      commandId: QUICK_OPEN_COMMANDS.OPEN.id,
      order: 0,
    });
  }

  registerEditorFeature(registry: IEditorFeatureRegistry): void {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        const aiEditorContribution = this.injector.get(AiEditorContribution, [editor]);
        return aiEditorContribution.contribute(editor);
      },
    });
  }

  registerCommands(commands: CommandRegistry): void {

    commands.registerCommand({
      id: 'ai.suggest.documentation',
    }, {
      execute: async (range: IRange) => {
        const currentEditor = this.editorService.currentEditor;
        if (!currentEditor || !range) {
          return;
        }

        const getContent = currentEditor.monacoEditor.getModel()!.getValueInRange(range);

        if (getContent) {
          const messageWithPrompt = `基于提供的代码，需要按照以下这种格式为这段代码添加 javadoc。
格式要求是:
/**
 * $\{关于这段代码的注释\}
 * 
 * 如果有参数，则添加 @param $\{参数信息\}。如果没有参数，则不需要添加 @param
 * @return $\{返回类型\}
 */

代码内容是:
${getContent}
`;

          const aiResult = await this.aiChatService.aiBackService.aiMFTCompletion(messageWithPrompt);
          const resultContent = aiResult.data;

          // 提取 markdown 里的代码
          const regex = /```java\s*([\s\S]+?)\s*```/;
          let code = regex.exec(resultContent)![1];

          if (!code) {
            return;
          }

          const monacoEditor = currentEditor.monacoEditor;

          if (monacoEditor) {
            const model = monacoEditor.getModel()!;

            const indents = ' '.repeat(4);

            const spcode = code.split('\n');
            code = spcode.map((s, i) => i === 0 ? s : indents + s).join('\n');

            model.pushStackElement();
            model.pushEditOperations(null, [
              {
                range,
                text: code,
              },
            ], () => null);
            model.pushStackElement();

            monacoEditor.focus();
          }
        }
      },
    });

    commands.registerCommand({
      id: 'ai.chat.createNewFile',
    }, {
      execute: async (fileName) => {
        const workspaceDir = this.appConfig.workspaceDir;
        return await this.fileTreeAPI.createFile(URI.parse(`${workspaceDir}/${fileName}`));
      },
    });

    commands.registerCommand({
      id: 'ai.chat.focusLine',
    }, {
      execute: async (line: number) => {
        line = Number(line);
        let currentEditor = this.editorService.currentEditor;
        if (!currentEditor) {
          this.editorService.setCurrentGroup(this.editorService.editorGroups[0]);
        }

        currentEditor = this.editorService.currentEditor;

        currentEditor?.monacoEditor.focus();
        setTimeout(() => {
          currentEditor?.monacoEditor.revealLineInCenter(Number(line));
          currentEditor?.monacoEditor.setPosition(
            new Position(line, 0),
          );
        }, 0);
      },
    });

    commands.registerCommand({
      id: 'cloudide.command.workspace.getRuntimeConfig',
    }, {
      execute: async (key: string) => {
        const obj = {
          workspaceIP: '127.0.0.1',
          workspaceDir: '/Users/mushi/Documents/workcode/opensumi/core/tools/workspace',
          proxyHost: 'https://ide.cloudbaseapp-sanbox.cn',
        };
        return obj[key];
      },
    });

    commands.registerCommand(AI_EXPLAIN_TERMINAL_COMMANDS, {
      execute: () => {
        const current = this.view.currentWidgetId;
        const client = this.terminalController.findClientFromWidgetId(current);
        if (client) {
          const name = client.name;
          const selectionContent = client.getSelection();

          this.aiChatService.launchChatMessage({
            message: '/explain @terminalSelection',
            prompt: `请解释一下这一段 ${name} 终端面板里的这部分内容: \`\`\`\n${selectionContent}\n\`\`\` `
          })
        }
      },
    });
  }
  // TerminalClient
  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.TerminalInstanceContext, {
      command: AI_EXPLAIN_TERMINAL_COMMANDS,
      group: '0_ai',
    });
  }

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    registry.registerEditorDocumentModelContentProvider(this.aiDiffDocumentProvider);
  }

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider({
      scheme: 'AI',
      provideResource: async (uri: URI): Promise<IResource<Partial<{ [prop: string]: any }>>> => ({
        uri,
        icon: getIcon('file-text'),
        name: `AI Diff ${uri.displayName}`,
      }),
    });
  }
}
