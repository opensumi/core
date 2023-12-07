import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  CommandContribution,
  CommandRegistry,
  ComponentContribution,
  ComponentRegistry,
  Domain,
  URI,
  getIcon,
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
  CommandService,
} from '@opensumi/ide-core-browser';
import { InlineChatIsVisible, InlineCompletionIsTrigger } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { DebugConsoleNode } from '@opensumi/ide-debug/lib/browser/tree';
import { IEditor } from '@opensumi/ide-editor';
import { ResourceService } from '@opensumi/ide-editor';
import { IResource } from '@opensumi/ide-editor';
import {
  BrowserEditorContribution,
  IEditorDocumentModelContentRegistry,
  IEditorFeatureRegistry,
} from '@opensumi/ide-editor/lib/browser';
import { SettingContribution } from '@opensumi/ide-preferences';
import { ITerminalController, ITerminalGroupViewService } from '@opensumi/ide-terminal-next';

import {
  AI_NATIVE_SETTING_GROUP_ID,
  AiNativeSettingSectionsId,
  Ai_CHAT_CONTAINER_VIEW_ID,
  InstructionEnum,
  IAIReporter,
} from '../common';
import {
  AI_EXPLAIN_DEBUG_COMMANDS,
  AI_EXPLAIN_TERMINAL_COMMANDS,
  AI_INLINE_CHAT_VISIBLE,
  AI_INLINE_COMPLETION_REPORTET,
  AI_INLINE_COMPLETION_VISIBLE,
  AI_RUN_DEBUG_COMMANDS,
} from '../common/command';

import { AiChatService } from './ai-chat.service';
import { AiChatView } from './ai-chat.view';
import { AiNativeConfig } from './ai-config';
import { AiEditorContribution } from './ai-editor.contribution';
import { AiProjectGenerateService } from './ai-project/generate.service';
import { AiSumiService } from './ai-sumi/sumi.service';
import { AiDiffDocumentProvider } from './diff-widget/ai-diff-document.provider';
import { AiInlineCompletionsProvider } from './inline-completions/completeProvider';
import { AiCompletionsService } from './inline-completions/service/ai-completions.service';
import {
  AiBottomTabRenderer,
  AiChatTabRenderer,
  AiLeftTabRenderer,
  AiRightTabRenderer,
} from './override/layout/tabbar.view';
import { AiRunService } from './run/run.service';
import { AiNativeCoreContribution, IAiRunFeatureRegistry, IInlineChatFeatureRegistry } from './types';

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
export class AiNativeBrowserContribution
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

  @Autowired(AiSumiService)
  private readonly aiSumi: AiSumiService;

  @Autowired(AiNativeCoreContribution)
  private readonly contributions: ContributionProvider<AiNativeCoreContribution>;

  @Autowired(IAiRunFeatureRegistry)
  private readonly aiRunFeatureRegistry: IAiRunFeatureRegistry;

  @Autowired(IInlineChatFeatureRegistry)
  private readonly inlineChatFeatureRegistry: IInlineChatFeatureRegistry;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(AiInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AiInlineCompletionsProvider;

  @Autowired(AiCompletionsService)
  private readonly aiCompletionsService: AiCompletionsService;

  @Autowired(AiNativeConfig)
  private readonly aiNativeConfig: AiNativeConfig;

  constructor() {
    this.registerFeature();
  }

  onStart() {
    this.aiProject.initRequirements();
  }

  onDidStart() {
    this.aiSumi.classifyCommand();
  }

  private registerFeature() {
    this.contributions.getContributions().forEach((contribution) => {
      if (contribution.registerRunFeature) {
        contribution.registerRunFeature(this.aiRunFeatureRegistry);
      }
      if (contribution.registerInlineChatFeature) {
        contribution.registerInlineChatFeature(this.inlineChatFeatureRegistry);
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
    const groups: ISettingSection[] = [];

    if (this.aiNativeConfig.capabilities.supportsInlineChat) {
      groups.push({
        title: 'Inline Chat',
        preferences: [
          {
            id: AiNativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
            localized: 'preference.aiNative.inlineChat.auto.visible',
          },
        ],
      });
    }

    return {
      ...settingSections,
      [AI_NATIVE_SETTING_GROUP_ID]: groups,
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

    commands.registerCommand(AI_INLINE_COMPLETION_REPORTET, {
      execute: (relationId: string, sessionId: string, accept: boolean) => {
        // 补全埋点统计
        this.aiReporter.end(relationId, { success: true, isReceive: true });
        this.aiCompletionsService.report({ sessionId, accept });
      },
    });

    commands.registerCommand(AI_INLINE_COMPLETION_VISIBLE, {
      execute: async (visible: boolean) => {
        if (!visible) {
          await this.commandService.executeCommand('editor.action.inlineSuggest.hide');
          this.aiCompletionsService.hideStatusBarItem();
          this.aiInlineCompletionsProvider.resetContextKey();
          this.aiInlineCompletionsProvider.cancelRequest();
          this.aiCompletionsService.setVisibleCompletion(false);
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
    if (this.aiNativeConfig.capabilities.supportsOpenSumiDesign) {
      registry.registerSlotRenderer(SlotLocation.left, AiLeftTabRenderer);
      registry.registerSlotRenderer(SlotLocation.right, AiRightTabRenderer);
      registry.registerSlotRenderer(SlotLocation.bottom, AiBottomTabRenderer);
      registry.registerSlotRenderer(Ai_CHAT_CONTAINER_VIEW_ID, AiChatTabRenderer);
    }
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    if (this.aiNativeConfig.capabilities.supportsInlineChat) {
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
        when: `editorFocus && ${InlineChatIsVisible.raw}`,
      });
    }

    if (this.aiNativeConfig.capabilities.supportsInlineCompletion) {
      keybindings.registerKeybinding({
        command: AI_INLINE_COMPLETION_VISIBLE.id,
        keybinding: 'esc',
        args: false,
        when: `editorFocus && ${InlineCompletionIsTrigger.raw}`,
      });
    }
  }
}
