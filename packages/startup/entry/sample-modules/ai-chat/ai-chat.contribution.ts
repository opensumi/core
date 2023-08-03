import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { AppConfig, CommandContribution, CommandRegistry, ComponentContribution, ComponentRegistry, Domain, IQuickOpenHandlerRegistry, Position, QUICK_OPEN_COMMANDS, URI, getIcon } from '@opensumi/ide-core-browser';
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
import { AiDiffDocumentProvider } from './diff-widget/ai-diff-document.provider';

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

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(AiChatService)
  protected readonly aiChatService: AiChatService;

  @Autowired()
  private readonly aiQuickCommandHandler: AiQuickCommandHandler;

  registerComponent(registry: ComponentRegistry): void {
    registry.register(AiChatContribution.AiChatContainer, {
      component: AiChatView,
      id: AiChatContribution.AiChatContainer,
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
      id: 'ai.chat.createNewFile',
    }, {
      execute: async (fileName) => {
        const workspaceDir = this.appConfig.workspaceDir;
        return await this.fileTreeAPI.createFile(URI.parse(`${workspaceDir}/${fileName}`));
      },
    });

    commands.registerCommand({
      id: 'ai.chat.createNodeHttpServerContent',
    }, {
      execute: async (prod) => {
        const currentEditor = this.editorService.currentEditor;
        if (!currentEditor) {
          return;
        }

        const newfile = URI.parse(currentEditor.currentUri?.path.toString()!);
        const stat = await this.fileServiceClient.getFileStat(newfile.toString(), false);

        if (!stat) {
          return;
        }

        await this.fileServiceClient.setContent(stat, `const http = require('http');

const server = http.createServer((request, response) => {
  // 设置响应头
  response.setHeader('Content-Type', 'text/plain');
  response.statusCode = 200;

  // 响应消息
  response.write('Hello, World!');
  response.end();
});

server.listen(${prod}, () => {
  console.log('Server running at http://localhost:${prod}/');
});`);
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
      id: 'ai.chat.createLazymanContent',
    }, {
      execute: async () => {
        const content = `class LazyMan {
  private taskList: Function[] = [];
  private name: string;

  constructor(name: string) {
    this.name = name;
    this.taskList.push(() => {
      console.log(\`Hi, I'm $\{this.name\}\`);
      this.next();
    });

    setTimeout(() => {
      this.next();
    }, 0);
  }

  private next() {
    const task = this.taskList.shift();
    task && task();
  }

  sleep(time: number) {
    this.taskList.push(() => {
      setTimeout(() => {
        console.log(\`Wake up after $\{time\}ms\`);
        this.next();
      }, time);
    });
    return this; // 实现链式调用
  }

  eat(food: string) {
    this.taskList.push(() => {
      console.log(\`Eat $\{food\}\`);
      this.next();
    });
    return this; // 实现链式调用
  }

  sleepFirst(time: number) {
    this.taskList.unshift(() => {
      setTimeout(() => {
        console.log(\`Wake up after $\{time\}ms\`);
        this.next();
      }, time);
    });
    return this; // 实现链式调用
  }
}

function lazyMan(name: string) {
  return new LazyMan(name);
}

// 测试代码
lazyMan('Jack').eat('breakfast').sleep(1000).eat('lunch').sleepFirst(1000).eat('dinner');
`;

        const currentEditor = this.editorService.currentEditor;
        if (!currentEditor) {
          return;
        }

        const newfile = URI.parse(currentEditor.currentUri?.path.toString()!);
        const stat = await this.fileServiceClient.getFileStat(newfile.toString(), false);

        if (!stat) {
          return;
        }

        return await this.fileServiceClient.setContent(stat, content);
      },
    });

    commands.registerCommand({
      id: 'ai.chat.replaceContent.eat',
    }, {
      execute: async (content: string) => {
        const currentEditor = this.editorService.currentEditor;
        if (!currentEditor) {
          return;
        }

        const monacoEditor = currentEditor.monacoEditor;

        const range = {
          startLineNumber: 32,
          startColumn: 0,
          endLineNumber: 38,
          endColumn: Number.MAX_SAFE_INTEGER,
        };

        if (monacoEditor) {
          const model = monacoEditor.getModel()!;

          model.pushStackElement();
          model.pushEditOperations(null, [
            {
              range,
              text: content,
            },
          ], () => null);
          model.pushStackElement();

          monacoEditor.focus();
          monacoEditor.setSelection(range);
        }
      },
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
