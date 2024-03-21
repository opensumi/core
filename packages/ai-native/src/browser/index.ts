import { Injectable, Injector, Provider } from '@opensumi/di';
import { AiNativeConfigService, BrowserModule, IAiInlineChatService, URI } from '@opensumi/ide-core-browser';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { AiBackSerivcePath, AiBackSerivceToken } from '@opensumi/ide-core-common/lib/ai-native';
import { RenameCandidatesProviderRegistryToken } from '@opensumi/ide-core-common/lib/types/ai-native';
import { IEditorTabService } from '@opensumi/ide-editor/lib/browser';
import { IMarkerService } from '@opensumi/ide-markers';
import { Color, IThemeData, IThemeStore, registerColor, RGBA, ThemeContribution } from '@opensumi/ide-theme';
import { ThemeStore } from '@opensumi/ide-theme/lib/browser/theme-store';

import { IAiChatService, IChatAgentService, IChatManagerService } from '../common';

import { AiChatService } from './ai-chat.service';
import { AiNativeBrowserContribution } from './ai-core.contribution';
import { ChatAgentService } from './chat-agent.service';
import { ChatAgentViewService } from './chat-agent.view.service';
import { ChatManagerService } from './chat-manager.service';
import { InlineChatFeatureRegistry } from './inline-chat-widget/inline-chat.feature.registry';
import { AiInlineChatService } from './inline-chat-widget/inline-chat.service';
import { LanguageParserFactory } from './languages/parser';
import { MergeConflictContribution } from './merge-conflict';
import { AiEditorTabService } from './override/ai-editor-tab.service';
import { AiMarkerService } from './override/ai-marker.service';
import { AiBrowserCtxMenuService } from './override/ai-menu.service';
import { AiChatLayoutConfig } from './override/layout/layout-config';
import { AiMenuBarContribution } from './override/layout/menu-bar/menu-bar.contribution';
import defaultTheme from './override/theme/default-theme';
import lightTheme from './override/theme/light-theme';
import { RenameCandidatesProviderRegistry } from './rename/rename.feature.registry';
import { AiRunFeatureRegistry } from './run/run.feature.registry';
import {
  AiNativeCoreContribution,
  IAiRunFeatureRegistry,
  IChatAgentViewService,
  IInlineChatFeatureRegistry,
} from './types';

@Injectable()
export class AiNativeModule extends BrowserModule {
  contributionProvider = AiNativeCoreContribution;
  providers: Provider[] = [
    AiNativeBrowserContribution,
    {
      token: IAiRunFeatureRegistry,
      useClass: AiRunFeatureRegistry,
    },
    {
      token: IInlineChatFeatureRegistry,
      useClass: InlineChatFeatureRegistry,
    },
    {
      token: IAiChatService,
      useClass: AiChatService,
    },
    {
      token: IAiInlineChatService,
      useClass: AiInlineChatService,
    },
    {
      token: IChatManagerService,
      useClass: ChatManagerService,
    },
    {
      token: IChatAgentService,
      useClass: ChatAgentService,
    },
    {
      token: IChatAgentViewService,
      useClass: ChatAgentViewService,
    },
    {
      token: LanguageParserFactory,
      useFactory: LanguageParserFactory,
    },
    {
      token: RenameCandidatesProviderRegistryToken,
      useClass: RenameCandidatesProviderRegistry,
    },
  ];

  preferences = (injector: Injector) => {
    const aiNativeConfig = injector.get(AiNativeConfigService);

    const { layoutViewSize } = this.app.config;
    let layoutConfig = this.app.config.layoutConfig;

    // 默认开启所有配置
    aiNativeConfig.enable();

    const { capabilities } = aiNativeConfig;
    const { supportsOpenSumiDesign, supportsAiMarkers, supportsAiChatAssistant, supportsConflictResolve } =
      capabilities;

    if (supportsOpenSumiDesign) {
      injector.addProviders(AiMenuBarContribution);

      if (!layoutViewSize) {
        this.app.config.layoutViewSize = {
          ...LAYOUT_VIEW_SIZE,
          MENUBAR_HEIGHT: 48,
          EDITOR_TABS_HEIGHT: 36,
          STATUSBAR_HEIGHT: 36,
          ACCORDION_HEADER_SIZE_HEIGHT: 36,
        };
      }

      injector.overrideProviders(
        {
          token: IBrowserCtxMenu,
          useClass: AiBrowserCtxMenuService,
        },
        {
          // AI Native 模式下默认使用该主题
          token: IThemeStore,
          useClass: class extends ThemeStore {
            override async getThemeData(contribution?: ThemeContribution, basePath?: URI) {
              const newTheme = await super.getThemeData(contribution, basePath);

              const theme = this.injector.get(IThemeData);
              let themeToken;
              if (contribution?.id?.includes('light')) {
                themeToken = lightTheme;
                document.body.classList.remove(defaultTheme.aiThemeType);
              } else {
                themeToken = defaultTheme;
                document.body.classList.remove(lightTheme.aiThemeType);
              }
              document.body.classList.add(themeToken.aiThemeType);
              theme.initializeFromData(themeToken);

              const colors = theme.colors;
              if (colors) {
                for (const colorId in colors) {
                  if (Object.prototype.hasOwnProperty.call(colors, colorId)) {
                    const colorHex = colors[colorId];
                    if (typeof colorHex === 'string') {
                      newTheme.colorMap[colorId] = Color.fromHex(colors[colorId]);
                    }
                  }
                }
              }

              const defaultRemoveColor = new Color(new RGBA(217, 108, 108, 0.2));
              registerColor(
                'diffEditor.removedLineBackground',
                { dark: defaultRemoveColor, light: defaultRemoveColor, hcDark: null, hcLight: null },
                '',
                true,
              );

              const defaultInsertColor = new Color(new RGBA(108, 217, 126, 0.2));
              registerColor(
                'diffEditor.insertedLineBackground',
                { dark: defaultInsertColor, light: defaultInsertColor, hcDark: null, hcLight: null },
                '',
                true,
              );

              return newTheme;
            }
          },
          override: true,
          isDefault: true,
        },
        {
          token: IEditorTabService,
          useClass: AiEditorTabService,
          override: true,
          isDefault: true,
        },
      );
    }

    if (supportsAiMarkers) {
      injector.overrideProviders({
        token: IMarkerService,
        useClass: AiMarkerService,
        override: true,
        isDefault: true,
      });
    }

    if (supportsAiChatAssistant) {
      layoutConfig = {
        ...layoutConfig,
        ...AiChatLayoutConfig,
      };
    }

    if (supportsConflictResolve) {
      injector.addProviders(MergeConflictContribution);
    }

    this.app.config.layoutConfig = layoutConfig;
  };

  backServices = [
    {
      servicePath: AiBackSerivcePath,
      token: AiBackSerivceToken,
      clientToken: IAiChatService,
    },
  ];
}
