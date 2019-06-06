import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, SlotLocation } from '@ali/ide-core-browser';
import { ExpressFileServerContribution } from './file-server.contribution';

@Injectable()
export class ExpressFileServerModule extends BrowserModule {
  providers: Provider[] = [
    ExpressFileServerContribution,
  ];
}
