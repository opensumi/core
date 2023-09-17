import { Provider, Injectable, Injector } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { AiChatContribution } from './ai-chat.contribution';
import { AiGPTBackSerivcePath, AiGPTBackSerivceToken } from '../common';
import { IMarkerService } from '@opensumi/ide-markers';
import { AiMarkerService } from './override/ai-marker.service';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IEditorTabService } from '@opensumi/ide-editor/lib/browser';
import { AiEditorTabService } from './override/ai-editor-tab.service';

import './override/global.styles.less';

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
      },
      {
        token: IEditorTabService,
        useClass: AiEditorTabService,
        override: true,
        isDefault: true
      }
    );

    if (!this.app.config.layoutViewSize) {
      this.app.config.layoutViewSize = {
        ...LAYOUT_VIEW_SIZE,
        MENUBAR_HEIGHT: 48,
        EDITOR_TABS_HEIGHT: 36,
        STATUSBAR_HEIGHT: 36,
        ACCORDION_HEADER_SIZE_HEIGHT: 36,
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
