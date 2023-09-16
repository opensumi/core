import { Provider, Injectable, Injector } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { AiChatContribution } from './ai-chat.contribution';
import { AiGPTBackSerivcePath, AiGPTBackSerivceToken } from '../common';
import { IMarkerService } from '@opensumi/ide-markers';
import { AiMarkerService } from './override/ai-marker.service';

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
    )
  }

  backServices = [
    {
      servicePath: AiGPTBackSerivcePath,
      token: AiGPTBackSerivceToken,
    },
  ];
}
