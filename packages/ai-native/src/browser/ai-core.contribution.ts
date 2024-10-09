import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
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
  InlineHintWidgetIsVisible,
  InlineInputWidgetIsVisible,
} from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import {
  AI_NATIVE_SETTING_GROUP_TITLE,
  ChatFeatureRegistryToken,
  ChatRenderRegistryToken,
  CommandService,
  InlineChatFeatureRegistryToken,
  IntelligentCompletionsRegistryToken,
  ProblemFixRegistryToken,
  RenameCandidatesProviderRegistryToken,
  ResolveConflictRegistryToken,
  TerminalRegistryToken,
  isUndefined,
  runWhenIdle,
} from '@opensumi/ide-core-common';
import { DESIGN_MENU_BAR_RIGHT } from '@opensumi/ide-design';
import { DesignBrowserCtxMenuService } from '@opensumi/ide-design/lib/browser/override/menu.service';
import { IEditor } from '@opensumi/ide-editor';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { ISettingRegistry, SettingContribution } from '@opensumi/ide-preferences';
import { EditorContributionInstantiation } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorExtensions';
import { HideInlineCompletion } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/inlineCompletions/browser/commands';
import { SyncDescriptor } from '@opensumi/monaco-editor-core/esm/vs/platform/instantiation/common/descriptors';

import {
  AI_CHAT_CONTAINER_ID,
  AI_CHAT_LOGO_AVATAR_ID,
  AI_CHAT_VIEW_ID,
  AI_MENU_BAR_DEBUG_TOOLBAR,
  ChatProxyServiceToken,
} from '../common';

import { ChatProxyService } from './chat/chat-proxy.service';
import { AIChatView } from './chat/chat.view';
import { CodeActionSingleHandler } from './contrib/code-action/code-action.handler';
import { AIInlineCompletionsProvider } from './contrib/inline-completions/completeProvider';
import { AICompletionsService } from './contrib/inline-completions/service/ai-completions.service';
import { IntelligentCompletionsController } from './contrib/intelligent-completions/intelligent-completions.controller';
import { ProblemFixController } from './contrib/problem-fix/problem-fix.controller';
import { RenameSingleHandler } from './contrib/rename/rename.handler';
import { AIRunToolbar } from './contrib/run-toolbar/run-toolbar';
import {
  AIChatTabRenderer,
  AIChatTabRendererWithTab,
  AILeftTabRenderer,
  AIRightTabRenderer,
} from './layout/tabbar.view';
import { AIChatLogoAvatar } from './layout/view/avatar/avatar.view';
import {
  AINativeCoreContribution,
  IChatFeatureRegistry,
  IChatRenderRegistry,
  IIntelligentCompletionsRegistry,
  IProblemFixProviderRegistry,
  IRenameCandidatesProviderRegistry,
  IResolveConflictRegistry,
  ITerminalProviderRegistry,
} from './types';
import { InlineChatEditorController } from './widget/inline-chat/inline-chat-editor.controller';
import { InlineChatFeatureRegistry } from './widget/inline-chat/inline-chat.feature.registry';
import { AIInlineChatService } from './widget/inline-chat/inline-chat.service';
import { InlineDiffController } from './widget/inline-diff/inline-diff.controller';
import { InlineHintController } from './widget/inline-hint/inline-hint.controller';
import { InlineInputController } from './widget/inline-input/inline-input.controller';
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
  private readonly appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IBrowserCtxMenu)
  private readonly ctxMenuRenderer: DesignBrowserCtxMenuService;

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

  @Autowired(ProblemFixRegistryToken)
  private readonly problemFixProviderRegistry: IProblemFixProviderRegistry;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(DesignLayoutConfig)
  private readonly designLayoutConfig: DesignLayoutConfig;

  @Autowired(AICompletionsService)
  private readonly aiCompletionsService: AICompletionsService;

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

  @Autowired(IAIInlineChatService)
  private readonly aiInlineChatService: AIInlineChatService;

  @Autowired(InlineInputChatService)
  private readonly inlineInputChatService: InlineInputChatService;

  @Autowired(InlineStreamDiffService)
  private readonly inlineStreamDiffService: InlineStreamDiffService;

  @Autowired(RenameSingleHandler)
  private readonly renameSingleHandler: RenameSingleHandler;

  @Autowired(CodeActionSingleHandler)
  private readonly codeActionSingleHandler: CodeActionSingleHandler;

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
    const { supportsInlineChat, supportsInlineCompletion, supportsProblemFix } =
      this.aiNativeConfigService.capabilities;

    register(
      InlineDiffController.ID,
      new SyncDescriptor(InlineDiffController, [this.injector]),
      EditorContributionInstantiation.Lazy,
    );

    if (supportsInlineChat) {
      register(SumiLightBulbWidget.ID, SumiLightBulbWidget, EditorContributionInstantiation.Lazy);
      register(
        InlineChatEditorController.ID,
        new SyncDescriptor(InlineChatEditorController, [this.injector]),
        EditorContributionInstantiation.BeforeFirstInteraction,
      );

      if (this.inlineChatFeatureRegistry.getInteractiveInputHandler()) {
        register(
          InlineHintController.ID,
          new SyncDescriptor(InlineHintController, [this.injector]),
          EditorContributionInstantiation.AfterFirstRender,
        );
        register(
          InlineInputController.ID,
          new SyncDescriptor(InlineInputController, [this.injector]),
          EditorContributionInstantiation.AfterFirstRender,
        );
      }
    }
    if (supportsInlineCompletion) {
      register(
        IntelligentCompletionsController.ID,
        new SyncDescriptor(IntelligentCompletionsController, [this.injector]),
        EditorContributionInstantiation.AfterFirstRender,
      );
    }
    if (supportsProblemFix) {
      register(
        ProblemFixController.ID,
        new SyncDescriptor(ProblemFixController, [this.injector]),
        EditorContributionInstantiation.AfterFirstRender,
      );
    }
  }

  onDidStart() {
    runWhenIdle(() => {
      const { supportsRenameSuggestions, supportsInlineChat } = this.aiNativeConfigService.capabilities;
      const prefChatVisibleType = this.preferenceService.getValid(AINativeSettingSectionsId.ChatVisibleType);

      if (prefChatVisibleType === 'always') {
        this.commandService.executeCommand(AI_CHAT_VISIBLE.id, true);
      } else if (prefChatVisibleType === 'never') {
        this.commandService.executeCommand(AI_CHAT_VISIBLE.id, false);
      }

      if (supportsRenameSuggestions) {
        this.renameSingleHandler.load();
      }

      if (supportsInlineChat) {
        this.codeActionSingleHandler.load();
      }
    });
  }

  private registerFeature() {
    this.contributions.getContributions().forEach((contribution) => {
      contribution.registerInlineChatFeature?.(this.inlineChatFeatureRegistry);
      contribution.registerChatFeature?.(this.chatFeatureRegistry);
      contribution.registerResolveConflictFeature?.(this.resolveConflictRegistry);
      contribution.registerRenameProvider?.(this.renameCandidatesProviderRegistry);
      contribution.registerChatRender?.(this.chatRenderRegistry);
      contribution.registerTerminalProvider?.(this.terminalProviderRegistry);
      contribution.registerIntelligentCompletionFeature?.(this.intelligentCompletionsRegistry);
      contribution.registerProblemFixFeature?.(this.problemFixProviderRegistry);
    });
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
        title: localize('preference.ai.native.intelligentCompletions.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.IntelligentCompletionsCacheEnabled,
            localized: 'preference.ai.native.intelligentCompletions.cache.enabled',
          },
          {
            id: AINativeSettingSectionsId.IntelligentCompletionsDebounceTime,
            localized: 'preference.ai.native.intelligentCompletions.debounceTime',
          },
          {
            id: AINativeSettingSectionsId.IntelligentCompletionsPromptEngineeringEnabled,
            localized: 'preference.ai.native.intelligentCompletions.promptEngineering.enabled',
          },
          {
            id: AINativeSettingSectionsId.IntelligentCompletionsAlwaysVisible,
            localized: 'preference.ai.native.intelligentCompletions.alwaysVisible',
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
      contribute: (editor: IEditor) => {
        const { monacoEditor } = editor;

        this.codeActionSingleHandler.mountEditor(editor.monacoEditor);

        return monacoEditor.onDidScrollChange(() => {
          if (this.ctxMenuRenderer.visible) {
            this.ctxMenuRenderer.hide(true);
          }
        });
      },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(AI_INLINE_CHAT_VISIBLE, {
      execute: (value: boolean) => {
        this.aiInlineChatService._onInlineChatVisible.fire(value);
      },
    });

    commands.registerCommand(AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE, {
      execute: (isVisible: boolean) => {
        if (isVisible) {
          this.inlineInputChatService.visible();
        } else {
          this.inlineInputChatService.hide();
        }

        this.aiInlineChatService._onInteractiveInputVisible.fire(isVisible);
      },
    });

    commands.registerCommand(AI_INLINE_COMPLETION_REPORTER, {
      execute: (relationId: string, sessionId: string, accept: boolean, code: string) => {
        this.aiCompletionsService.report({ sessionId, accept, relationId, code });
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
    if (this.designLayoutConfig.supportExternalChatPanel) {
      registry.registerSlotRenderer(AI_CHAT_VIEW_ID, AIChatTabRendererWithTab);
    } else {
      registry.registerSlotRenderer(AI_CHAT_VIEW_ID, AIChatTabRenderer);
    }

    if (this.designLayoutConfig.useMergeRightWithLeftPanel) {
      registry.registerSlotRenderer(SlotLocation.left, AILeftTabRenderer);
      registry.registerSlotRenderer(SlotLocation.right, AIRightTabRenderer);
    }
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(AI_CHAT_CONTAINER_ID, [], {
      component: AIChatView,
      title: localize('aiNative.chat.ai.assistant.name'),
      iconClass: getIcon('magic-wand'),
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

      if (this.inlineChatFeatureRegistry.getInteractiveInputHandler()) {
        keybindings.registerKeybinding(
          {
            command: AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id,
            keybinding: 'ctrlcmd+k',
            args: true,
            priority: 0,
            when: `editorFocus && ${InlineChatIsVisible.raw}`,
          },
          KeybindingScope.USER,
        );

        keybindings.registerKeybinding({
          command: AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id,
          keybinding: 'esc',
          args: false,
          priority: 0,
          when: `editorFocus && ${InlineInputWidgetIsVisible.raw}`,
        });

        keybindings.registerKeybinding(
          {
            command: AI_INLINE_CHAT_INTERACTIVE_INPUT_VISIBLE.id,
            keybinding: 'ctrlcmd+k',
            args: true,
            priority: 0,
            when: `editorFocus && ${InlineHintWidgetIsVisible.raw} && ${InlineChatIsVisible.not}`,
          },
          KeybindingScope.USER,
        );
      }
    }

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
  }
}
