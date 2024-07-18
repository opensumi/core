import { Autowired } from '@opensumi/di';
import {
  AINativeConfigService,
  AINativeSettingSectionsId,
  AI_NATIVE_SETTING_GROUP_ID,
  AppConfig,
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  ComponentContribution,
  ComponentRegistry,
  ComponentRegistryImpl,
  ContributionProvider,
  Domain,
  IAIInlineChatService,
  IEditorExtensionContribution,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
  MonacoContribution,
  PreferenceService,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';
import {
  AI_CHAT_VISIBLE,
  AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE,
  AI_INLINE_CHAT_VISIBLE,
  AI_INLINE_COMPLETION_REPORTER,
  AI_INLINE_COMPLETION_VISIBLE,
  AI_INLINE_DIFF_PARTIAL_EDIT,
} from '@opensumi/ide-core-browser/lib/ai-native/command';
import {
  InlineChatIsVisible,
  InlineDiffPartialEditsIsVisible,
  InlineInputWidgetIsVisible,
} from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import {
  AI_NATIVE_SETTING_GROUP_TITLE,
  ChatFeatureRegistryToken,
  ChatRenderRegistryToken,
  CommandService,
  InlineChatFeatureRegistryToken,
  IntelligentCompletionsRegistryToken,
  RenameCandidatesProviderRegistryToken,
  ResolveConflictRegistryToken,
  TerminalRegistryToken,
  isUndefined,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { DESIGN_MENU_BAR_RIGHT } from '@opensumi/ide-design';
import { IEditor } from '@opensumi/ide-editor';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { Position } from '@opensumi/ide-monaco';
import { ISettingRegistry, SettingContribution } from '@opensumi/ide-preferences';
import { EditorContributionInstantiation } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorExtensions';
import { HideInlineCompletion } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/commands';

import {
  AI_CHAT_CONTAINER_ID,
  AI_CHAT_LOGO_AVATAR_ID,
  AI_CHAT_VIEW_ID,
  AI_MENU_BAR_DEBUG_TOOLBAR,
  ChatProxyServiceToken,
} from '../common';

import { AIEditorContribution } from './ai-editor.contribution';
import { ChatProxyService } from './chat/chat-proxy.service';
import { AIChatView } from './chat/chat.view';
import { CodeActionHandler } from './contrib/code-action/code-action.handler';
import { AIInlineCompletionsProvider } from './contrib/inline-completions/completeProvider';
import { InlineCompletionHandler } from './contrib/inline-completions/inline-completions.handler';
import { AICompletionsService } from './contrib/inline-completions/service/ai-completions.service';
import { RenameHandler } from './contrib/rename/rename.handler';
import { AIRunToolbar } from './contrib/run-toolbar/run-toolbar';
import { AIChatTabRenderer, AILeftTabRenderer, AIRightTabRenderer } from './layout/tabbar.view';
import { AIChatLogoAvatar } from './layout/view/avatar/avatar.view';
import {
  AINativeCoreContribution,
  IAIMiddleware,
  IChatFeatureRegistry,
  IChatRenderRegistry,
  IIntelligentCompletionsRegistry,
  IRenameCandidatesProviderRegistry,
  IResolveConflictRegistry,
  ITerminalProviderRegistry,
} from './types';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { AIInlineChatService } from './widget/inline-chat/inline-chat.service';
import { InlineInputChatService } from './widget/inline-input/inline-input.service';
import { InlineStreamDiffService } from './widget/inline-stream-diff/inline-stream-diff.service';
import { SumiLightBulbWidget } from './widget/light-bulb';

@Domain(
  ClientAppContribution,
  BrowserEditorContribution,
  CommandContribution,
  SettingContribution,
  KeybindingContribution,
  ComponentContribution,
  SlotRendererContribution,
  MonacoContribution,
)
export class AINativeBrowserContribution
  implements
    ClientAppContribution,
    BrowserEditorContribution,
    CommandContribution,
    SettingContribution,
    KeybindingContribution,
    ComponentContribution,
    SlotRendererContribution,
    MonacoContribution
{
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(AINativeCoreContribution)
  private readonly contributions: ContributionProvider<AINativeCoreContribution>;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: InlineChatFeatureRegistry;

  @Autowired(ChatFeatureRegistryToken)
  private readonly chatFeatureRegistry: IChatFeatureRegistry;

  @Autowired(ChatRenderRegistryToken)
  private readonly chatRenderRegistry: IChatRenderRegistry;

  @Autowired(ResolveConflictRegistryToken)
  private readonly resolveConflictRegistry: IResolveConflictRegistry;

  @Autowired(RenameCandidatesProviderRegistryToken)
  private readonly renameCandidatesProviderRegistry: IRenameCandidatesProviderRegistry;

  @Autowired(TerminalRegistryToken)
  private readonly terminalProviderRegistry: ITerminalProviderRegistry;

  @Autowired(IntelligentCompletionsRegistryToken)
  private readonly intelligentCompletionsRegistry: IIntelligentCompletionsRegistry;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(DesignLayoutConfig)
  private readonly designLayoutConfig: DesignLayoutConfig;

  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  @Autowired(AIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AIInlineCompletionsProvider;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  @Autowired(ChatProxyServiceToken)
  private readonly chatProxyService: ChatProxyService;

  @Autowired(AIEditorContribution)
  private readonly aiEditorFeatureContribution: AIEditorContribution;

  @Autowired(IAIInlineChatService)
  private readonly aiInlineChatService: AIInlineChatService;

  @Autowired(RenameHandler)
  private readonly renameHandler: RenameHandler;

  @Autowired(InlineCompletionHandler)
  private readonly inlineCompletionHandler: InlineCompletionHandler;

  @Autowired(CodeActionHandler)
  private readonly codeActionHandler: CodeActionHandler;

  @Autowired(InlineInputChatService)
  private readonly inlineInputChatService: InlineInputChatService;

  @Autowired(InlineStreamDiffService)
  private readonly inlineStreamDiffService: InlineStreamDiffService;

  constructor() {
    this.registerFeature();
  }

  initialize() {
    const { supportsChatAssistant } = this.aiNativeConfigService.capabilities;

    if (supportsChatAssistant) {
      ComponentRegistryImpl.addLayoutModule(this.appConfig.layoutConfig, AI_CHAT_VIEW_ID, AI_CHAT_CONTAINER_ID);
      ComponentRegistryImpl.addLayoutModule(this.appConfig.layoutConfig, DESIGN_MENU_BAR_RIGHT, AI_CHAT_LOGO_AVATAR_ID);
      this.chatProxyService.registerDefaultAgent();
    }
  }

  registerEditorExtensionContribution(register: IEditorExtensionContribution<any[]>): void {
    const { supportsInlineChat } = this.aiNativeConfigService.capabilities;
    if (supportsInlineChat) {
      register(SumiLightBulbWidget.ID, SumiLightBulbWidget, EditorContributionInstantiation.Lazy);
    }
  }

  onDidStart() {
    runWhenIdle(() => {
      const prefChatVisibleType = this.preferenceService.getValid(AINativeSettingSectionsId.ChatVisibleType);

      if (prefChatVisibleType === 'always') {
        this.commandService.executeCommand(AI_CHAT_VISIBLE.id, true);
      } else if (prefChatVisibleType === 'never') {
        this.commandService.executeCommand(AI_CHAT_VISIBLE.id, false);
      }
    });

    if (this.aiNativeConfigService.capabilities.supportsRenameSuggestions) {
      this.renameHandler.load();
    }
    if (this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
      this.inlineCompletionHandler.load();
    }
    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      this.codeActionHandler.load();
    }
  }

  private registerFeature() {
    const middlewares: IAIMiddleware[] = [];

    this.contributions.getContributions().forEach((contribution) => {
      const contributions = [
        { key: contribution.registerInlineChatFeature, registry: this.inlineChatFeatureRegistry },
        { key: contribution.registerChatFeature, registry: this.chatFeatureRegistry },
        { key: contribution.registerResolveConflictFeature, registry: this.resolveConflictRegistry },
        { key: contribution.registerRenameProvider, registry: this.renameCandidatesProviderRegistry },
        { key: contribution.registerChatRender, registry: this.chatRenderRegistry },
        { key: contribution.registerTerminalProvider, registry: this.terminalProviderRegistry },
        { key: contribution.registerIntelligentCompletionFeature, registry: this.intelligentCompletionsRegistry },
      ];

      for (const contrib of contributions) {
        if (contrib.key) {
          contrib.key(contrib.registry as any);
        }
      }

      if (contribution.middleware) {
        middlewares.push(contribution.middleware);
      }
    });

    this.inlineCompletionHandler.updateConfig(middlewares);
  }

  registerSetting(registry: ISettingRegistry) {
    registry.registerSettingGroup({
      id: AI_NATIVE_SETTING_GROUP_ID,
      title: AI_NATIVE_SETTING_GROUP_TITLE,
      iconClass: getIcon('magic-wand'),
    });

    registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
      title: localize('preference.ai.native.chat.title'),
      preferences: [
        {
          id: AINativeSettingSectionsId.ChatVisibleType,
          localized: 'preference.ai.native.chat.visible.type',
        },
      ],
    });

    registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
      title: localize('preference.ai.native.interface.quick.title'),
      preferences: [
        {
          id: AINativeSettingSectionsId.InterfaceQuickNavigationEnabled,
          localized: 'preference.ai.native.interface.quick.navigation',
        },
      ],
    });

    if (this.aiNativeConfigService.capabilities.supportsInlineCompletion) {
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.ai.native.inlineCompletions.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.InlineCompletionsCacheEnabled,
            localized: 'preference.ai.native.inlineCompletions.cache.enabled',
          },
          {
            id: AINativeSettingSectionsId.InlineCompletionsDebounceTime,
            localized: 'preference.ai.native.inlineCompletions.debounceTime',
          },
          {
            id: AINativeSettingSectionsId.InlineCompletionsPromptEngineeringEnabled,
            localized: 'preference.ai.native.inlineCompletions.promptEngineering.enabled',
          },
        ],
      });
    }

    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.ai.native.inlineChat.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.InlineChatAutoVisible,
            localized: 'preference.ai.native.inlineChat.auto.visible',
          },
          {
            id: AINativeSettingSectionsId.InlineChatCodeActionEnabled,
            localized: 'preference.ai.native.inlineChat.codeAction.enabled',
          },
          {
            id: AINativeSettingSectionsId.InlineDiffPreviewMode,
            localized: 'preference.ai.native.inlineDiff.preview.mode',
          },
        ],
      });
    }
  }

  registerEditorFeature(registry: IEditorFeatureRegistry): void {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => this.aiEditorFeatureContribution.contribute(editor),
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(AI_INLINE_CHAT_VISIBLE, {
      execute: (value: boolean) => {
        this.aiInlineChatService._onInlineChatVisible.fire(value);
      },
    });

    commands.registerCommand(AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE, {
      execute: (positionFn: () => Position) => {
        if (positionFn) {
          const posi = positionFn();

          if (posi) {
            this.inlineInputChatService.visibleInPosition(posi);
          } else {
            this.inlineInputChatService.hide();
          }
        }

        this.aiInlineChatService._onInteractiveInputVisible.fire(true);
      },
    });

    commands.registerCommand(AI_INLINE_COMPLETION_REPORTER, {
      execute: (relationId: string, sessionId: string, accept: boolean) => {
        this.aiCompletionsService.report({ sessionId, accept, relationId });
      },
    });

    commands.registerCommand(AI_CHAT_VISIBLE, {
      execute: (visible?: boolean) => {
        this.layoutService.toggleSlot(AI_CHAT_VIEW_ID, isUndefined(visible) ? true : visible);
      },
    });

    commands.registerCommand(AI_INLINE_COMPLETION_VISIBLE, {
      execute: async (visible: boolean) => {
        if (!visible) {
          this.aiCompletionsService.hideStatusBarItem();
          this.aiInlineCompletionsProvider.cancelRequest();
          this.aiCompletionsService.setVisibleCompletion(false);
        }
      },
    });

    commands.registerCommand(AI_INLINE_DIFF_PARTIAL_EDIT, {
      execute: (isAccept: boolean) => {
        this.inlineStreamDiffService.launchAcceptDiscardPartialEdit(isAccept);
      },
    });

    /**
     * 当 inline completion 消失时
     */
    commands.afterExecuteCommand(HideInlineCompletion.ID, () => {
      this.commandService.executeCommand(AI_INLINE_COMPLETION_VISIBLE.id, false);
    });
  }

  registerRenderer(registry: SlotRendererRegistry): void {
    registry.registerSlotRenderer(AI_CHAT_VIEW_ID, AIChatTabRenderer);
    if (this.designLayoutConfig.useMergeRightWithLeftPanel) {
      registry.registerSlotRenderer(SlotLocation.left, AILeftTabRenderer);
      registry.registerSlotRenderer(SlotLocation.right, AIRightTabRenderer);
    }
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(AI_CHAT_CONTAINER_ID, [], {
      component: AIChatView,
      containerId: AI_CHAT_CONTAINER_ID,
    });
    registry.register(AI_MENU_BAR_DEBUG_TOOLBAR, {
      id: AI_MENU_BAR_DEBUG_TOOLBAR,
      component: AIRunToolbar,
    });
    registry.register(AI_CHAT_LOGO_AVATAR_ID, {
      id: AI_CHAT_LOGO_AVATAR_ID,
      component: AIChatLogoAvatar,
    });
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
      keybindings.registerKeybinding({
        command: AI_INLINE_DIFF_PARTIAL_EDIT.id,
        keybinding: 'ctrl+y',
        args: true,
        priority: 100,
        when: `editorTextFocus && ${InlineDiffPartialEditsIsVisible.raw}`,
      });
      keybindings.registerKeybinding({
        command: AI_INLINE_DIFF_PARTIAL_EDIT.id,
        keybinding: 'ctrl+n',
        args: false,
        priority: 100,
        when: `editorTextFocus && ${InlineDiffPartialEditsIsVisible.raw}`,
      });

      if (this.inlineChatFeatureRegistry.getInteractiveInputHandler()) {
        keybindings.registerKeybinding(
          {
            command: AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id,
            keybinding: 'ctrlcmd+k',
            priority: 0,
            when: `editorFocus && ${InlineChatIsVisible.raw}`,
          },
          KeybindingScope.USER,
        );

        keybindings.registerKeybinding({
          command: AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id,
          keybinding: 'esc',
          args: () => undefined,
          priority: 0,
          when: `editorFocus && ${InlineInputWidgetIsVisible.raw}`,
        });
      }
    }
  }
}
