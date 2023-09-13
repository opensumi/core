import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { AiGPTBackSerivcePath, AiGPTBackSerivceToken } from '../../src/common/index';

import { AiChatContribution } from '../../src/browser/ai-chat/ai-chat.contribution';
import { EditorEmptyComponentContribution } from './editor-empty-component.contribution';
import { MenuBarContribution } from './menu-bar/menu-bar.contribution';
import { StatusBarContribution } from './status-bar.contribution';

@Injectable()
export class SampleModule extends BrowserModule {
  providers: Provider[] = [
    MenuBarContribution,
    EditorEmptyComponentContribution,
    StatusBarContribution,
    AiChatContribution,
  ];

  backServices = [
    {
      servicePath: AiGPTBackSerivcePath,
      token: AiGPTBackSerivceToken,
    },
  ];
}
