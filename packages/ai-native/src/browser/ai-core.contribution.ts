import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  AiNativeConfigService,
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  CommandService,
  ComponentContribution,
  ComponentRegistry,
  ContributionProvider,
  Domain,
  ISettingGroup,
  ISettingSection,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
  URI,
  getIcon,
} from '@opensumi/ide-core-browser';
import {
  AI_CHAT_PANEL_TOGGLE_VISIBLE,
  AI_EXPLAIN_DEBUG_COMMANDS,
  AI_EXPLAIN_TERMINAL_COMMANDS,
  AI_INLINE_CHAT_VISIBLE,
  AI_INLINE_COMPLETION_REPORTET,
  AI_INLINE_COMPLETION_VISIBLE,
  AI_RUN_DEBUG_COMMANDS,
} from '@opensumi/ide-core-browser/lib/ai-native/command';
import { getStorageValue } from '@opensumi/ide-core-browser/lib/components';
import { InlineChatIsVisible, InlineCompletionIsTrigger } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { LayoutState, LAYOUT_STATE } from '@opensumi/ide-core-browser/lib/layout/layout-state';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { DebugConsoleNode } from '@opensumi/ide-debug/lib/browser/tree';
import { IEditor, IResource, ResourceService } from '@opensumi/ide-editor';
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
  AI_CHAT_DEFAULT_SIZE,
  InstructionEnum,
} from '../common';

import { AiChatService } from './ai-chat.service';
import { AiChatView } from './ai-chat.view';
import { AiEditorContribution } from './ai-editor.contribution';
import { AiProjectGenerateService } from './ai-project/generate.service';
import { AiSumiService } from './ai-sumi/sumi.service';
import { AiDiffDocumentProvider } from './diff-widget/ai-diff-document.provider';
import { AiInlineCompletionsProvider } from './inline-completions/completeProvider';
import { AiCompletionsService } from './inline-completions/service/ai-completions.service';
import { AiMenubarService } from './override/layout/menu-bar/menu-bar.service';
import {
  AiBottomTabRenderer,
  AiChatTabRenderer,
  AiLeftTabRenderer,
  AiRightTabRenderer,
} from './override/layout/tabbar.view';
import { AiRunService } from './run/run.service';
import { AIRunToolbar } from './run/toolbar/run-toolbar';
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

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(AiInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AiInlineCompletionsProvider;

  @Autowired(AiCompletionsService)
  private readonly aiCompletionsService: AiCompletionsService;

  @Autowired(AiNativeConfigService)
  private readonly aiNativeConfigService: AiNativeConfigService;

  @Autowired(AiMenubarService)
  private readonly aiMenubarService: AiMenubarService;

  @Autowired(LayoutState)
  private layoutState: LayoutState;

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

    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
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
    registry.register('AI_MENU_BAR_DEBUG_TOOLBAR', {
      id: 'AI_MENU_BAR_DEBUG_TOOLBAR',
      component: AIRunToolbar,
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
            message: `分析以下内容：\`\`\`\n${description}\`\`\``,
            prompt: `在 IDE 中进行调试时，程序输出了一些错误信息，请尝试解释报错并给出解决方案，报错信息如下：\`\`\`\n${description}\n\`\`\` `,
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
        this.aiCompletionsService.report({ sessionId, accept, relationId });
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

    commands.registerCommand(AI_CHAT_PANEL_TOGGLE_VISIBLE, {
      execute: (visible: boolean) => {
        const { layout } = getStorageValue();
        if (layout[Ai_CHAT_CONTAINER_VIEW_ID]?.currentId) {
          this.updateLayoutState({
            currentId: '',
            // 默认初始化尺寸有问题，在这里修正
            size: AI_CHAT_DEFAULT_SIZE,
          });
        } else {
          this.updateLayoutState({
            currentId: Ai_CHAT_CONTAINER_VIEW_ID,
            // 默认初始化尺寸有问题，在这里修正
            size: AI_CHAT_DEFAULT_SIZE,
          });
        }
        if (visible === true) {
          if (this.aiMenubarService.getLatestWidth() !== 0) {
            this.aiMenubarService.toggleRightPanel();
          }
          return;
        }

        if (visible === false) {
          if (this.aiMenubarService.getLatestWidth() === 0) {
            this.aiMenubarService.toggleRightPanel();
          }
          return;
        }

        this.aiMenubarService.toggleRightPanel();
      },
    });

    // 拦截 git.stage 命令，来统计智能解决冲突的数据
    commands.beforeExecuteCommand('git.stage', (args) => args);
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
    if (this.aiNativeConfigService.capabilities.supportsOpenSumiDesign) {
      registry.registerSlotRenderer(SlotLocation.left, AiLeftTabRenderer);
      registry.registerSlotRenderer(SlotLocation.right, AiRightTabRenderer);
      registry.registerSlotRenderer(SlotLocation.bottom, AiBottomTabRenderer);
      registry.registerSlotRenderer(Ai_CHAT_CONTAINER_VIEW_ID, AiChatTabRenderer);
    }
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
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

    if (this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
      keybindings.registerKeybinding({
        command: AI_INLINE_COMPLETION_VISIBLE.id,
        keybinding: 'esc',
        args: false,
        when: `editorFocus && ${InlineCompletionIsTrigger.raw}`,
      });
    }
  }

  private updateLayoutState(stateVal: { currentId: string; size: number }) {
    this.layoutState.setState(LAYOUT_STATE.MAIN, {
      ...this.layoutState.getState(LAYOUT_STATE.MAIN, {}),
      [Ai_CHAT_CONTAINER_VIEW_ID]: stateVal,
    });
  }
}
