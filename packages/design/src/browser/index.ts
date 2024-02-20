import { Injectable, Injector, Provider } from '@opensumi/di';
import { BrowserModule, URI } from '@opensumi/ide-core-browser';
import { ISplitPanelService } from '@opensumi/ide-core-browser/lib/components/layout/split-panel.service';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { IEditorTabService } from '@opensumi/ide-editor/lib/browser';
import { Color, IThemeContribution, IThemeData, IThemeStore, RGBA, registerColor } from '@opensumi/ide-theme';
import { ThemeStore } from '@opensumi/ide-theme/lib/browser/theme-store';

import { DesignCoreContribution } from './design.contribution';
import { DesignEditorTabService } from './override/editor-tab.service';
import { DesignBrowserCtxMenuService } from './override/menu.service';
import { DesignSplitPanelService } from './override/split-panel.service';
import defaultTheme from './theme/default-theme';
import lightTheme from './theme/light-theme';

@Injectable()
export class DesignModule extends BrowserModule {
  providers: Provider[] = [
    DesignCoreContribution,
    {
      token: ISplitPanelService,
      useClass: DesignSplitPanelService,
      override: true,
      isDefault: true,
    },
  ];

  preferences = (injector: Injector) => {
    import('./style/index.less');

    injector.overrideProviders(
      {
        // AI Native 模式下默认使用该主题
        token: IThemeStore,
        useClass: class extends ThemeStore {
          override async getThemeData(contribution?: IThemeContribution, basePath?: URI) {
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
        useClass: DesignEditorTabService,
        override: true,
        isDefault: true,
      },
      {
        token: IBrowserCtxMenu,
        useClass: DesignBrowserCtxMenuService,
      },
    );
  };
}
