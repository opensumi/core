import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  AppConfig,
  CommandContribution,
  CommandRegistry,
  ComponentContribution,
  ComponentRegistry,
  Domain,
  Position,
  URI,
  getIcon,
  IRange,
  SlotRendererContribution,
  SlotRendererRegistry,
  SlotLocation,
  ContributionProvider,
  ClientAppContribution,
  ISettingSection,
  ISettingGroup,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
} from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { DebugConsoleNode } from '@opensumi/ide-debug/lib/browser/tree';
import { IEditor } from '@opensumi/ide-editor';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { ResourceService } from '@opensumi/ide-editor';
import { IResource } from '@opensumi/ide-editor';
import {
  BrowserEditorContribution,
  IEditorDocumentModelContentRegistry,
  IEditorFeatureRegistry,
} from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { IFileTreeAPI } from '@opensumi/ide-file-tree-next';
import { PreferenceSettingId, SettingContribution } from '@opensumi/ide-preferences';
import { ITerminalController, ITerminalGroupViewService } from '@opensumi/ide-terminal-next';

import {
  AI_NATIVE_SETTING_GROUP_ID,
  AiNativeContribution,
  AiNativeSettingSectionsId,
  Ai_CHAT_CONTAINER_VIEW_ID,
  IAiRunFeatureRegistry,
  InstructionEnum,
} from '../common';
import {
  AI_EXPLAIN_DEBUG_COMMANDS,
  AI_EXPLAIN_TERMINAL_COMMANDS,
  AI_INLINE_CHAT_VISIBLE,
  AI_RUN_DEBUG_COMMANDS,
} from '../common/command';

import { AiChatService } from './ai-chat.service';
import { AiChatView } from './ai-chat.view';
import { AiEditorContribution } from './ai-editor.contribution';
import { AiProjectGenerateService } from './ai-project/generate.service';
import { AiDiffDocumentProvider } from './diff-widget/ai-diff-document.provider';
import {
  AiBottomTabRenderer,
  AiChatTabRenderer,
  AiLeftTabRenderer,
  AiRightTabRenderer,
} from './override/layout/tabbar.view';
import { AiRunService } from './run/run.service';

@Injectable()
@Domain(
  ClientAppContribution,
  ComponentContribution,
  BrowserEditorContribution,
  MenuContribution,
  CommandContribution,
  SlotRendererContribution,
  SettingContribution,
  KeybindingContribution,
)
export class AiNativeCoreContribution
  implements
    ClientAppContribution,
    ComponentContribution,
    BrowserEditorContribution,
    MenuContribution,
    CommandContribution,
    SlotRendererContribution,
    SettingContribution,
    KeybindingContribution
{
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
  private readonly aiChatService: AiChatService;

  @Autowired(ITerminalGroupViewService)
  private readonly view: ITerminalGroupViewService;

  @Autowired(ITerminalController)
  private readonly terminalController: ITerminalController;

  @Autowired(AiRunService)
  private readonly aiRunService: AiRunService;

  @Autowired(AiProjectGenerateService)
  private readonly aiProject: AiProjectGenerateService;

  @Autowired(AiNativeContribution)
  private readonly contributions: ContributionProvider<AiNativeContribution>;

  @Autowired(IAiRunFeatureRegistry)
  private readonly aiRunFeatureRegistry: IAiRunFeatureRegistry;

  onStart() {
    this.registerFeature();
    this.aiProject.initRequirements();
  }

  private registerFeature() {
    this.contributions.getContributions().forEach((contribution) => {
      if (contribution.registerRunFeature) {
        contribution.registerRunFeature(this.aiRunFeatureRegistry);
      }
    });
  }

  handleSettingGroup(settingGroup: ISettingGroup[]) {
    return [
      ...settingGroup,
      {
        id: AI_NATIVE_SETTING_GROUP_ID,
        title: AI_NATIVE_SETTING_GROUP_ID,
        iconClass: getIcon('magic-wand'),
      },
    ];
  }

  handleSettingSections(settingSections: { [key: string]: ISettingSection[] }) {
    return {
      ...settingSections,
      [AI_NATIVE_SETTING_GROUP_ID]: [
        {
          title: 'Inline Chat',
          preferences: [
            {
              id: AiNativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
              localized: 'preference.aiNative.inlineChat.auto.visible',
            },
          ],
        },
      ],
    };
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      Ai_CHAT_CONTAINER_VIEW_ID,
      {
        component: AiChatView,
        id: Ai_CHAT_CONTAINER_VIEW_ID,
      },
      {
        containerId: Ai_CHAT_CONTAINER_VIEW_ID,
      },
    );
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
    commands.registerCommand(
      {
        id: 'ai.suggest.documentation',
      },
      {
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
              code = spcode.map((s, i) => (i === 0 ? s : indents + s)).join('\n');

              model.pushStackElement();
              model.pushEditOperations(
                null,
                [
                  {
                    range,
                    text: code,
                  },
                ],
                () => null,
              );
              model.pushStackElement();

              monacoEditor.focus();
            }
          }
        },
      },
    );

    commands.registerCommand(
      {
        id: 'ai.chat.createNewFile',
      },
      {
        execute: async (fileName) => {
          const workspaceDir = this.appConfig.workspaceDir;
          return await this.fileTreeAPI.createFile(URI.parse(`${workspaceDir}/${fileName}`));
        },
      },
    );

    commands.registerCommand(
      {
        id: 'ai.chat.focusLine',
      },
      {
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
            currentEditor?.monacoEditor.setPosition(new Position(line, 0));
          }, 0);
        },
      },
    );

    commands.registerCommand(
      {
        id: 'cloudide.command.workspace.getRuntimeConfig',
      },
      {
        execute: async (key: string) => {
          const obj = {
            workspaceIP: '127.0.0.1',
            workspaceDir: '/Users/mushi/Documents/workcode/opensumi/core/tools/workspace',
            proxyHost: 'https://ide.cloudbaseapp-sanbox.cn',
          };
          return obj[key];
        },
      },
    );

    commands.registerCommand(AI_EXPLAIN_TERMINAL_COMMANDS, {
      execute: () => {
        const current = this.view.currentWidgetId;
        const client = this.terminalController.findClientFromWidgetId(current);
        if (client) {
          const name = client.name;
          const selectionContent = client.getSelection();

          this.aiChatService.launchChatMessage({
            message: `${InstructionEnum.aiExplainKey} @terminalSelection`,
            prompt: `请解释一下这一段 ${name} 终端面板里的这部分内容: \`\`\`\n${selectionContent}\n\`\`\` `,
          });
        }
      },
    });

    commands.registerCommand(AI_EXPLAIN_DEBUG_COMMANDS, {
      execute: (node: DebugConsoleNode) => {
        const description = node.description;
        if (description) {
          this.aiChatService.launchChatMessage({
            message: `${InstructionEnum.aiExplainKey} @debugSelection`,
            prompt: `我在运行并调试我的项目代码，请解释调试运行过程当中的这段日志: \`\`\`\n${description}\n\`\`\` `,
          });
        }
      },
    });

    commands.registerCommand(AI_RUN_DEBUG_COMMANDS, {
      execute: () => {
        this.aiRunService.run();
      },
    });

    commands.registerCommand(AI_INLINE_CHAT_VISIBLE, {
      execute: (value) => {
        this.aiChatService.launchInlineChatVisible(value);
      },
    });
  }
  // TerminalClient
  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.TerminalInstanceContext, {
      command: AI_EXPLAIN_TERMINAL_COMMANDS,
      group: '0_ai',
    });

    menus.registerMenuItem(MenuId.DebugConsoleContext, {
      command: AI_EXPLAIN_DEBUG_COMMANDS,
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

  registerRenderer(registry: SlotRendererRegistry): void {
    registry.registerSlotRenderer(SlotLocation.left, AiLeftTabRenderer);
    registry.registerSlotRenderer(SlotLocation.right, AiRightTabRenderer);
    registry.registerSlotRenderer(SlotLocation.bottom, AiBottomTabRenderer);
    registry.registerSlotRenderer(Ai_CHAT_CONTAINER_VIEW_ID, AiChatTabRenderer);
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding(
      {
        command: AI_INLINE_CHAT_VISIBLE.id,
        keybinding: 'ctrlcmd+i',
        when: 'editorTextFocus',
        args: true,
        priority: 0,
      },
      KeybindingScope.USER,
    );

    keybindings.registerKeybinding({
      command: AI_INLINE_CHAT_VISIBLE.id,
      keybinding: 'esc',
      args: false,
    });
  }
}
