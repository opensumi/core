import { Injectable, Injector, Provider } from '@opensumi/di';
import { BrowserModule, URI } from '@opensumi/ide-core-browser';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { IEditorTabService } from '@opensumi/ide-editor/lib/browser';
import { IMarkerService } from '@opensumi/ide-markers';
import { Color, IThemeData, IThemeStore, registerColor, RGBA, ThemeContribution } from '@opensumi/ide-theme';
import { ThemeStore } from '@opensumi/ide-theme/lib/browser/theme-store';

import {
  AiBackSerivcePath,
  AiBackSerivceToken,
  AiNativeContribution,
  IAiChatService,
  IAiRunFeatureRegistry,
  IAIReporter,
} from '../common';

import { AiChatService } from './ai-chat.service';
import { AiNativeConfig } from './ai-config';
import { AiNativeCoreContribution } from './ai-core.contribution';
import { AIReporter } from './ai-reporter';
import { AiEditorTabService } from './override/ai-editor-tab.service';
import { AiMarkerService } from './override/ai-marker.service';
import { AiBrowserCtxMenuService } from './override/ai-menu.service';
import { AiChatLayoutConfig, AiTopLayoutConfig } from './override/layout/layout-config';
import { AiMenuBarContribution } from './override/layout/menu-bar/menu-bar.contribution';
import defaultTheme from './override/theme/default-theme';
import { AiRunFeatureRegistry } from './run/run.feature.registry';

@Injectable()
export class AiNativeModule extends BrowserModule {
  contributionProvider = AiNativeContribution;
  providers: Provider[] = [
    AiNativeCoreContribution,
    {
      token: IAiRunFeatureRegistry,
      useClass: AiRunFeatureRegistry,
    },
    {
      token: IAiChatService,
      useClass: AiChatService,
    },
    {
      token: IAIReporter,
      useClass: AIReporter,
    },
  ];

  preferences = (injector: Injector) => {
    const aiNativeConfig = injector.get(AiNativeConfig);

    const { layoutViewSize } = this.app.config;
    let layoutConfig = this.app.config.layoutConfig;

    const { capabilities } = aiNativeConfig;
    const { supportsOpenSumiDesign, supportsAiMarkers, supportsAiChatAssistant } = capabilities;

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

      layoutConfig = {
        ...layoutConfig,
        ...AiTopLayoutConfig,
      };

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
              theme.initializeFromData(defaultTheme);

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
