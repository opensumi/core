import { Injectable } from '@opensumi/di';
import { AIBackSerivcePath, AIBackSerivceToken, BrowserModule } from '@opensumi/ide-core-browser';

@Injectable()
export class AINativeModule extends BrowserModule {
  backServices = [
    {
      servicePath: AIBackSerivcePath,
      token: AIBackSerivceToken,
    },
  ];
}
