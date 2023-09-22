import { Injectable, Injector, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IEditorTabService } from '@opensumi/ide-editor/lib/browser';
import { IMarkerService } from '@opensumi/ide-markers';
import { Color, IThemeData, IThemeStore } from '@opensumi/ide-theme';
import { ThemeData } from '@opensumi/ide-theme/lib/browser/theme-data';
import { ThemeStore } from '@opensumi/ide-theme/lib/browser/theme-store';

import { AiGPTBackSerivcePath, AiGPTBackSerivceToken, AiNativeContribution, IAiRunFeatureRegistry } from '../common';

import { AiNativeCoreContribution } from './ai-chat.contribution';
import { AiEditorTabService } from './override/ai-editor-tab.service';
import { AiMarkerService } from './override/ai-marker.service';
import { AiMenuBarContribution } from './override/layout/menu-bar/menu-bar.contribution';
import defaultTheme from './override/theme/default-theme';
import { AiRunFeatureRegistry } from './run/run.feature.registry';

@Injectable()
export class AiNativeModule extends BrowserModule {
  contributionProvider = AiNativeContribution;
  providers: Provider[] = [
    AiMenuBarContribution,
    AiNativeCoreContribution,
    {
      token: IAiRunFeatureRegistry,
      useClass: AiRunFeatureRegistry,
    },
  ];

  preferences = (injector: Injector) => {
    injector.overrideProviders(
      {
        token: IMarkerService,
        useClass: AiMarkerService,
        override: true,
        isDefault: true,
      },
      {
        token: IEditorTabService,
        useClass: AiEditorTabService,
        override: true,
        isDefault: true,
      },
      {
        token: IThemeData,
        useClass: class extends ThemeData {
          override getDefaultTheme() {
            return defaultTheme;
          }
        },
        override: true,
        isDefault: true,
      },
      {
        // AI Native 模式下默认使用该主题
        token: IThemeStore,
        useClass: class extends ThemeStore {
          override async getThemeData() {
            const theme = this.loadDefaultTheme();
            const colors = theme.colors;
            if (colors) {
              for (const colorId in colors) {
                if (Object.prototype.hasOwnProperty.call(colors, colorId)) {
                  const colorHex = colors[colorId];
                  if (typeof colorHex === 'string') {
                    theme.colorMap[colorId] = Color.fromHex(colors[colorId]);
                  }
                }
              }
            }

            return theme;
          }
        },
        override: true,
        isDefault: true,
      },
    );

    if (!this.app.config.layoutViewSize) {
      this.app.config.layoutViewSize = {
        ...LAYOUT_VIEW_SIZE,
        MENUBAR_HEIGHT: 48,
        EDITOR_TABS_HEIGHT: 36,
        STATUSBAR_HEIGHT: 36,
        ACCORDION_HEADER_SIZE_HEIGHT: 36,
      };
    }
  };

  backServices = [
    {
      servicePath: AiGPTBackSerivcePath,
      token: AiGPTBackSerivceToken,
    },
  ];
}
