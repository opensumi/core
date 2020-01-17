import { Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileSearchContribution } from './file-search.contribution';

@Injectable()
export class ClientAddonModule extends BrowserModule {
  providers = [
    FileSearchContribution,
  ];
}
