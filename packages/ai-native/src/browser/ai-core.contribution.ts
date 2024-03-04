import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  AINativeConfigService,
  AINativeSettingSectionsId,
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  ContributionProvider,
  Domain,
  ISettingGroup,
  ISettingSection,
  KeybindingContribution,
  KeybindingRegistry,
  KeybindingScope,
  URI,
  getIcon,
} from '@opensumi/ide-core-browser';
import { AI_INLINE_CHAT_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { InlineChatIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { Schemes, localize } from '@opensumi/ide-core-common';
import { AI_NATIVE_SETTING_GROUP_ID } from '@opensumi/ide-core-common/src/settings/ai-native';
import { IEditor, IResource, ResourceService } from '@opensumi/ide-editor';
import {
  BrowserEditorContribution,
  IEditorDocumentModelContentRegistry,
  IEditorFeatureRegistry,
} from '@opensumi/ide-editor/lib/browser';
import { SettingContribution } from '@opensumi/ide-preferences';


import { AIEditorContribution } from './ai-editor.contribution';
import { AINativeService } from './ai-native.service';
import { AIDiffDocumentProvider } from './diff-widget/ai-diff-document.provider';
import { IAINativeCoreContribution, IInlineChatFeatureRegistry } from './types';

@Injectable()
@Domain(
  ClientAppContribution,
  BrowserEditorContribution,
  CommandContribution,
  SettingContribution,
  KeybindingContribution,
)
export class AINativeBrowserContribution
  implements
    ClientAppContribution,
    BrowserEditorContribution,
    CommandContribution,
    SettingContribution,
    KeybindingContribution
{
  @Autowired()
  private readonly aiDiffDocumentProvider: AIDiffDocumentProvider;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IAINativeCoreContribution)
  private readonly contributions: ContributionProvider<IAINativeCoreContribution>;

  @Autowired(IInlineChatFeatureRegistry)
  private readonly inlineChatFeatureRegistry: IInlineChatFeatureRegistry;

  @Autowired(AINativeService)
  private readonly aiNativeService: AINativeService;

  @Autowired(AINativeConfigService)
  private readonly aiNativeConfigService: AINativeConfigService;

  constructor() {
    this.registerFeature();
  }

  onDidStart() {}

  private registerFeature() {
    this.contributions.getContributions().forEach((contribution) => {
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
        title: localize('preference.aiNative.inlineChat.title'),
        preferences: [
          {
            id: AINativeSettingSectionsId.INLINE_CHAT_AUTO_VISIBLE,
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

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    registry.registerEditorDocumentModelContentProvider(this.aiDiffDocumentProvider);
  }

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider({
      scheme: Schemes.ai,
      provideResource: async (uri: URI): Promise<IResource<Partial<{ [prop: string]: any }>>> => ({
        uri,
        icon: getIcon('file-text'),
        name: `AI Diff ${uri.displayName}`,
      }),
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
