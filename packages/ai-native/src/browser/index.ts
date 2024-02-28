import { Injectable } from '@opensumi/di';
import { AiBackSerivcePath, AiBackSerivceToken, BrowserModule } from '@opensumi/ide-core-browser';

@Injectable()
export class AiNativeModule extends BrowserModule {
  backServices = [
    {
      servicePath: AiBackSerivcePath,
      token: AiBackSerivceToken,
    },
  ];
}
