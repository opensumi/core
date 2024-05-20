import { Injectable, Injector, Provider } from '@opensumi/di';
import { BrowserModule, URI } from '@opensumi/ide-core-browser';
import { ISplitPanelService } from '@opensumi/ide-core-browser/lib/components/layout/split-panel.service';
import { IDesignStyleService } from '@opensumi/ide-core-browser/lib/design';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import {
  AppLifeCycleServiceToken,
  Event,
  IAppLifeCycleService,
  LifeCyclePhase,
  Schemes,
} from '@opensumi/ide-core-common';
import { IEditorTabService } from '@opensumi/ide-editor/lib/browser';
import { IThemeContribution, IThemeService, IThemeStore } from '@opensumi/ide-theme';
import { ThemeStore } from '@opensumi/ide-theme/lib/browser/theme-store';
import { WorkbenchThemeService } from '@opensumi/ide-theme/lib/browser/workbench.theme.service';

import { DesignCoreContribution } from './design.contribution';
import { DesignMenuBarContribution } from './menu-bar/menu-bar.contribution';
import { DesignEditorTabService } from './override/editor-tab.service';
import { DesignBrowserCtxMenuService } from './override/menu.service';
import { DesignSplitPanelService } from './override/split-panel.service';
import designStyles from './style/design.module.less';
import defaultTheme from './theme/default-theme';
import lightTheme from './theme/light-theme';

@Injectable()
export class DesignModule extends BrowserModule {
  providers: Provider[] = [DesignMenuBarContribution, DesignCoreContribution];

  preferences = (injector: Injector) => {
    import('./style/global.less');

    const designStyleService: IDesignStyleService = injector.get(IDesignStyleService);
    designStyleService.setStyles(designStyles);

    const appLifeCycleService: IAppLifeCycleService = injector.get(AppLifeCycleServiceToken);

    Event.once(Event.filter(appLifeCycleService.onDidLifeCyclePhaseChange, (phase) => phase === LifeCyclePhase.Ready))(
      () => {
        const themeService: IThemeService = injector.get(IThemeService);

        [defaultTheme, lightTheme].forEach((theme) => {
          themeService.registerThemes(
            [
              {
                id: theme.id,
                label: theme.name,
                path: '',
                extensionId: theme.id,
                uiTheme: theme.base,
              },
            ],
            URI.parse(`${theme.id}.json`).withQuery(theme.id).withScheme(Schemes.design),
          );
        });
      },
    );

    injector.overrideProviders(
      {
        token: IThemeStore,
        useClass: class extends ThemeStore {
          override async getThemeData(contribution?: IThemeContribution, basePath?: URI) {
            const newTheme = await super.getThemeData(contribution, basePath);
            document.body.classList.remove(lightTheme.designThemeType);
            document.body.classList.remove(defaultTheme.designThemeType);

            if (defaultTheme.id === contribution?.id) {
              document.body.classList.add(defaultTheme.designThemeType);
            } else if (lightTheme.id === contribution?.id) {
              document.body.classList.add(lightTheme.designThemeType);
            }
            return newTheme;
          }
          override getDefaultThemeID(): string {
            return defaultTheme.id;
          }
        },
        override: true,
        isDefault: true,
      },
      {
        token: IThemeService,
        useClass: class extends WorkbenchThemeService {
          override async ensureValidTheme(): Promise<string> {
            return super.ensureValidTheme(defaultTheme.id);
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
