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
  AI_INLINE_CHAT_VISIBLE,
  AI_INLINE_COMPLETION_REPORTER,
  AI_INLINE_COMPLETION_VISIBLE,
} from '@opensumi/ide-core-browser/lib/ai-native/command';
import { InlineChatIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import {
  AI_NATIVE_SETTING_GROUP_TITLE,
  ChatFeatureRegistryToken,
  ChatRenderRegistryToken,
  CommandService,
  InlineChatFeatureRegistryToken,
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
import { ISettingRegistry, SettingContribution } from '@opensumi/ide-preferences';
import { EditorContributionInstantiation } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorExtensions';

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
import { AIInlineCompletionsProvider } from './contrib/inline-completions/completeProvider';
import { AICompletionsService } from './contrib/inline-completions/service/ai-completions.service';
import { AIRunToolbar } from './contrib/run-toolbar/run-toolbar';
import { AIChatTabRenderer, AILeftTabRenderer, AIRightTabRenderer } from './layout/tabbar.view';
import { AIChatLogoAvatar } from './layout/view/avatar/avatar.view';
import {
  AINativeCoreContribution,
  IChatFeatureRegistry,
  IChatRenderRegistry,
  IInlineChatFeatureRegistry,
  IRenameCandidatesProviderRegistry,
  IResolveConflictRegistry,
  ITerminalProviderRegistry,
} from './types';
import { AIInlineChatService } from './widget/inline-chat/inline-chat.service';
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
  private readonly inlineChatFeatureRegistry: IInlineChatFeatureRegistry;

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

  constructor() {
    this.registerFeature();
  }

  initialize() {
    this.aiNativeConfigService.enableCapabilities();

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
      const prefChatVisibleType = this.preferenceService.getValid(AINativeSettingSectionsId.CHAT_VISIBLE_TYPE);

      if (prefChatVisibleType === 'always') {
        this.commandService.executeCommand(AI_CHAT_VISIBLE.id, true);
      } else if (prefChatVisibleType === 'never') {
        this.commandService.executeCommand(AI_CHAT_VISIBLE.id, false);
      }
    });
  }

  private registerFeature() {
    this.contributions.getContributions().forEach((contribution) => {
      if (contribution.registerInlineChatFeature) {
        contribution.registerInlineChatFeature(this.inlineChatFeatureRegistry);
      }
      if (contribution.registerChatFeature) {
        contribution.registerChatFeature(this.chatFeatureRegistry);
      }
      if (contribution.registerResolveConflictFeature) {
        contribution.registerResolveConflictFeature(this.resolveConflictRegistry);
      }
      if (contribution.registerRenameProvider) {
        contribution.registerRenameProvider(this.renameCandidatesProviderRegistry);
      }
      if (contribution.registerChatRender) {
        contribution.registerChatRender(this.chatRenderRegistry);
      }
      if (contribution.registerTerminalProvider) {
        contribution.registerTerminalProvider(this.terminalProviderRegistry);
      }
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
          id: AINativeSettingSectionsId.CHAT_VISIBLE_TYPE,
          localized: 'preference.ai.native.chat.visible.type',
        },
      ],
    });

    registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
      title: localize('preference.ai.native.interface.quick.title'),
      preferences: [
        {
          id: AINativeSettingSectionsId.INTERFACE_QUICK_NAVIGATION_ENABLED,
          localized: 'preference.ai.native.interface.quick.navigation',
        },
      ],
    });

    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.ai.native.inlineChat.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
            localized: 'preference.ai.native.inlineChat.auto.visible',
          },
          {
            id: AINativeSettingSectionsId.INLINE_CHAT_CODE_ACTION_ENABLED,
            localized: 'preference.ai.native.inlineChat.codeAction.enabled',
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
          await this.commandService.executeCommand('editor.action.inlineSuggest.hide');
          this.aiCompletionsService.hideStatusBarItem();
          this.aiInlineCompletionsProvider.resetContextKey();
          this.aiInlineCompletionsProvider.cancelRequest();
          this.aiCompletionsService.setVisibleCompletion(false);
        }
      },
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
    }
  }
}
