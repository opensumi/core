import { Injectable, Injector, Provider } from '@opensumi/di';
import { BrowserModule, URI } from '@opensumi/ide-core-browser';
import { ISplitPanelService } from '@opensumi/ide-core-browser/lib/components/layout/split-panel.service';
import { IDesignStyleService } from '@opensumi/ide-core-browser/lib/design';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { IEditorTabService } from '@opensumi/ide-editor/lib/browser';
import { Color, IThemeContribution, IThemeData, IThemeStore } from '@opensumi/ide-theme';
import { ThemeStore } from '@opensumi/ide-theme/lib/browser/theme-store';

import { DesignCoreContribution } from './design.contribution';
import { DesignEditorTabService } from './override/editor-tab.service';
import { DesignBrowserCtxMenuService } from './override/menu.service';
import { DesignSplitPanelService } from './override/split-panel.service';
import designStyles from './style/design.module.less';
import defaultTheme from './theme/default-theme';
import lightTheme from './theme/light-theme';

@Injectable()
export class DesignModule extends BrowserModule {
  providers: Provider[] = [DesignCoreContribution];

  preferences = (injector: Injector) => {
    import('./style/global.less');

    const designStyleService: IDesignStyleService = injector.get(IDesignStyleService);
    // console.log('designStyles:>>>>', designStyles)
    designStyleService.setStyles(designStyles);

    injector.overrideProviders(
      {
        token: IThemeStore,
        useClass: class extends ThemeStore {
          override async getThemeData(contribution?: IThemeContribution, basePath?: URI) {
            const newTheme = await super.getThemeData(contribution, basePath);

            const theme = this.injector.get(IThemeData);
            let themeToken;
            if (contribution?.id?.includes('light')) {
              themeToken = lightTheme;
              document.body.classList.remove(defaultTheme.designThemeType);
            } else {
              themeToken = defaultTheme;
              document.body.classList.remove(lightTheme.designThemeType);
            }
            document.body.classList.add(themeToken.designThemeType);
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
        token: ISplitPanelService,
        useClass: DesignSplitPanelService,
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
