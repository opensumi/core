import { Provider, Injectable, Injector } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { AiChatContribution } from './ai-chat.contribution';
import { AiGPTBackSerivcePath, AiGPTBackSerivceToken } from '../common';
import { IMarkerService } from '@opensumi/ide-markers';
import { AiMarkerService } from './override/ai-marker.service';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';

@Injectable()
export class AiNativeModule extends BrowserModule {
  providers: Provider[] = [
    AiChatContribution
  ];

  preferences = (injector: Injector) => {
    injector.overrideProviders(
      {
        token: IMarkerService,
        useClass: AiMarkerService,
        override: true,
        isDefault: true
      }
    );

    if (!this.app.config.layoutViewSize) {
      this.app.config.layoutViewSize = {
        ...LAYOUT_VIEW_SIZE,
        MENUBAR_HEIGHT: 48,
        EDITOR_TABS_HEIGHT: 36,
        BIG_SUR_TITLEBAR_HEIGHT: 28,
        TITLEBAR_HEIGHT: 22,
        PANEL_TITLEBAR_HEIGHT: 35,
        STATUSBAR_HEIGHT: 36,
      }
    }
  }

  backServices = [
    {
      servicePath: AiGPTBackSerivcePath,
      token: AiGPTBackSerivceToken,
    },
  ];
}
