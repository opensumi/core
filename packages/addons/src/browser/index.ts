import { Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileSearchContribution } from './file-search.contribution';
import { StatusBarContribution } from './status-bar-contribution';
import { LanguageChangeHintContribution } from './langauge-change.contribution';

@Injectable()
export class ClientAddonModule extends BrowserModule {
  providers = [
    LanguageChangeHintContribution,
    FileSearchContribution,
    StatusBarContribution,
  ];
}
