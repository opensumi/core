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
  ContributionProvider,
  Domain,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
  SlotLocation,
  SlotRendererContribution,
  SlotRendererRegistry,
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';
import {
  AI_INLINE_CHAT_VISIBLE,
  AI_INLINE_COMPLETION_REPORTER,
  AI_INLINE_COMPLETION_VISIBLE,
} from '@opensumi/ide-core-browser/lib/ai-native/command';
import { InlineChatIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import {
  ChatFeatureRegistryToken,
  CommandService,
  InlineChatFeatureRegistryToken,
  MaybePromise,
  RenameCandidatesProviderRegistryToken,
  ResolveConflictRegistryToken,
} from '@opensumi/ide-core-common';
import { IEditor } from '@opensumi/ide-editor';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '@opensumi/ide-editor/lib/browser';
import { ISettingRegistry, SettingContribution } from '@opensumi/ide-preferences';

import { AI_CHAT_CONTAINER_VIEW_ID } from '../common';

import { AIEditorContribution } from './ai-editor.contribution';
import { AINativeService } from './ai-native.service';
import { AIChatView } from './chat/chat.view';
import { AIInlineCompletionsProvider } from './inline-completions/completeProvider';
import { AICompletionsService } from './inline-completions/service/ai-completions.service';
import { AIChatLayoutConfig, AIMenubarLayoutConfig } from './layout/layout-config';
import { AIChatTabRenderer, AILeftTabRenderer, AIRightTabRenderer } from './layout/tabbar.view';
import {
  AINativeCoreContribution,
  IChatFeatureRegistry,
  IInlineChatFeatureRegistry,
  IRenameCandidatesProviderRegistry,
  IResolveConflictRegistry,
} from './types';

@Domain(
  ClientAppContribution,
  BrowserEditorContribution,
  CommandContribution,
  SettingContribution,
  KeybindingContribution,
  ComponentContribution,
  SlotRendererContribution,
)
export class AINativeBrowserContribution
  implements
    ClientAppContribution,
    BrowserEditorContribution,
    CommandContribution,
    SettingContribution,
    KeybindingContribution,
    ComponentContribution,
    SlotRendererContribution
{
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(AINativeCoreContribution)
  private readonly contributions: ContributionProvider<AINativeCoreContribution>;

  @Autowired(InlineChatFeatureRegistryToken)
  private readonly inlineChatFeatureRegistry: IInlineChatFeatureRegistry;

  @Autowired(ChatFeatureRegistryToken)
  private readonly chatFeatureRegistry: IChatFeatureRegistry;

  @Autowired(ResolveConflictRegistryToken)
  private readonly resolveConflictRegistry: IResolveConflictRegistry;

  @Autowired(RenameCandidatesProviderRegistryToken)
  private readonly renameCandidatesProviderRegistry: IRenameCandidatesProviderRegistry;

  @Autowired(AINativeService)
  private readonly aiNativeService: AINativeService;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  @Autowired(AICompletionsService)
  private aiCompletionsService: AICompletionsService;

  @Autowired(AIInlineCompletionsProvider)
  private readonly aiInlineCompletionsProvider: AIInlineCompletionsProvider;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  constructor() {
    this.registerFeature();
  }

  prepare(): MaybePromise<void> {
    this.aiNativeConfigService.enableCapabilities();
  }

  initialize() {
    const { supportsChatAssistant } = this.aiNativeConfigService.capabilities;
    const { useMenubarView } = this.aiNativeConfigService.layout;

    let layoutConfig = this.appConfig.layoutConfig;
    let layoutViewSize = this.appConfig.layoutViewSize;

    if (supportsChatAssistant) {
      layoutConfig = {
        ...layoutConfig,
        ...AIChatLayoutConfig,
      };
    }

    if (useMenubarView) {
      layoutViewSize = {
        ...layoutViewSize,
        menubarHeight: 48,
      };

      layoutConfig = {
        ...layoutConfig,
        ...AIMenubarLayoutConfig,
      };
    }

    this.appConfig.layoutConfig = layoutConfig;
    this.appConfig.layoutViewSize = layoutViewSize;
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
    });
  }

  registerSetting(registry: ISettingRegistry) {
    registry.registerSettingGroup({
      id: AI_NATIVE_SETTING_GROUP_ID,
      title: AI_NATIVE_SETTING_GROUP_ID,
      iconClass: getIcon('magic-wand'),
    });

    if (this.aiNativeConfigService.capabilities.supportsInlineChat) {
      registry.registerSettingSection(AI_NATIVE_SETTING_GROUP_ID, {
        title: localize('preference.aiNative.inlineChat.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
            localized: 'preference.aiNative.inlineChat.auto.visible',
          },
        ],
      });
    }
  }

  registerEditorFeature(registry: IEditorFeatureRegistry): void {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        const aiEditorContribution = this.injector.get(AIEditorContribution, [editor]);
        return aiEditorContribution.contribute(editor);
      },
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(AI_INLINE_CHAT_VISIBLE, {
      execute: (value: boolean) => {
        this.aiNativeService.launchInlineChatVisible(value);
      },
    });

    commands.registerCommand(AI_INLINE_COMPLETION_REPORTER, {
      execute: (relationId: string, sessionId: string, accept: boolean) => {
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
  }

  registerRenderer(registry: SlotRendererRegistry): void {
    registry.registerSlotRenderer(AI_CHAT_CONTAINER_VIEW_ID, AIChatTabRenderer);
    if (this.aiNativeConfigService.layout.useMergeRightWithLeftPanel) {
      registry.registerSlotRenderer(SlotLocation.left, AILeftTabRenderer);
      registry.registerSlotRenderer(SlotLocation.right, AIRightTabRenderer);
    }
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      AI_CHAT_CONTAINER_VIEW_ID,
      {
        component: AIChatView,
        id: AI_CHAT_CONTAINER_VIEW_ID,
      },
      {
        containerId: AI_CHAT_CONTAINER_VIEW_ID,
      },
    );
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
