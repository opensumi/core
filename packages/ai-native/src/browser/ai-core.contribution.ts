import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import {
  AINativeConfigService,
  AINativeSettingSectionsId,
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
  SlotRendererContribution,
  SlotRendererRegistry,
  getIcon,
} from '@opensumi/ide-core-browser';
import { AI_INLINE_CHAT_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { InlineChatIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { localize } from '@opensumi/ide-core-common';
import { AI_NATIVE_SETTING_GROUP_ID } from '@opensumi/ide-core-common/src/settings/ai-native';
import { IEditor } from '@opensumi/ide-editor';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '@opensumi/ide-editor/lib/browser';
import { ISettingRegistry, SettingContribution } from '@opensumi/ide-preferences';

import { Ai_CHAT_CONTAINER_VIEW_ID } from '../common';

import { AIEditorContribution } from './ai-editor.contribution';
import { AINativeService } from './ai-native.service';
import { AiChatView } from './chat/ai-chat.view';
import { AiChatLayoutConfig } from './layout/layout-config';
import { AiChatTabRenderer } from './layout/tabbar.view';
import { AINativeCoreContribution, IInlineChatFeatureRegistry } from './types';

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

  @Autowired(IInlineChatFeatureRegistry)
  private readonly inlineChatFeatureRegistry: IInlineChatFeatureRegistry;

  @Autowired(AINativeService)
  private readonly aiNativeService: AINativeService;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  constructor() {
    this.registerFeature();
  }

  initialize() {
    this.aiNativeConfigService.enable();

    const supportsAiChatAssistant = this.aiNativeConfigService.capabilities.supportsChatAssistant;

    let layoutConfig = this.appConfig.layoutConfig;

    if (supportsAiChatAssistant) {
      layoutConfig = {
        ...layoutConfig,
        ...AiChatLayoutConfig,
      };
    }

    this.appConfig.layoutConfig = layoutConfig;
  }

  private registerFeature() {
    this.contributions.getContributions().forEach((contribution) => {
      if (contribution.registerInlineChatFeature) {
        contribution.registerInlineChatFeature(this.inlineChatFeatureRegistry);
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
  }

  registerRenderer(registry: SlotRendererRegistry): void {
    if (this.aiNativeConfigService.capabilities.supportsOpenSumiDesign) {
      registry.registerSlotRenderer(Ai_CHAT_CONTAINER_VIEW_ID, AiChatTabRenderer);
    }
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
