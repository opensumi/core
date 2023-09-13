import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { AppConfig, CommandContribution, CommandRegistry, ComponentContribution, ComponentRegistry, Domain, IQuickOpenHandlerRegistry, Position, QUICK_OPEN_COMMANDS, URI, getIcon, IRange } from '@opensumi/ide-core-browser';
import { QuickOpenContribution } from '@opensumi/ide-core-browser';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution } from '@opensumi/ide-core-browser/lib/menu/next';
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
import { AiCodeDocumentProvider } from './code-widget/ai-code-document.provider';
import { AiDiffDocumentProvider } from './diff-widget/ai-diff-document.provider';

@Injectable()
@Domain(ComponentContribution, QuickOpenContribution, BrowserEditorContribution, MenuContribution, CommandContribution)
export class AiChatContribution implements ComponentContribution, QuickOpenContribution, BrowserEditorContribution, MenuContribution, CommandContribution {

  static AiChatContainer = 'ai-chat';

  @Autowired()
  private readonly aiDiffDocumentProvider: AiDiffDocumentProvider;

  @Autowired()
  private readonly aiCodeDocumentProvider: AiCodeDocumentProvider;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IFileTreeAPI)
  private readonly fileTreeAPI: IFileTreeAPI;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(AiChatService)
  protected readonly aiChatService: AiChatService;

  @Autowired()
  private readonly aiQuickCommandHandler: AiQuickCommandHandler;

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

    commands.registerCommand({
      id: 'open-port.external',
    }, {
      execute: async (port: number) => `http://127.0.0.1:${port}`,
    });
  }

  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItems('ai/iconMenubar/context', [
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getExternalIcon('hubot'),
        group: 'ai_group_1',
      },
      {
        command: 'main-layout.right-panel.show',
        iconClass: getExternalIcon('comment-discussion'),
        group: 'ai_group_1',
      },
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getExternalIcon('debug'),
        group: 'ai_group_1',
      },
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getExternalIcon('book'),
        group: 'ai_group_2',
      },
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getExternalIcon('list-unordered'),
        group: 'ai_group_2',
      },
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getExternalIcon('symbol-color'),
        group: 'ai_group_3',
      },
      {
        command: 'main-layout.left-panel.toggle',
        iconClass: getExternalIcon('wand'),
        group: 'ai_group_3',
      },
    ]);
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
