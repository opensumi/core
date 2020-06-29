import { Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileSearchContribution } from './file-search.contribution';
import { StatusBarContribution } from './status-bar-contribution';
import { ToolbarCustomizeContribution } from './toolbar-customize/toolbar-customize.contribution';

@Injectable()
export class ClientAddonModule extends BrowserModule {
  providers = [
    FileSearchContribution,
    StatusBarContribution,
    ToolbarCustomizeContribution,
  ];
}
