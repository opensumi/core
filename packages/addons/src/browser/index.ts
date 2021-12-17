import { Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { FileSearchContribution } from './file-search.contribution';
import { StatusBarContribution } from './status-bar-contribution';
import { ToolbarCustomizeContribution } from './toolbar-customize/toolbar-customize.contribution';
import { LanguageChangeHintContribution } from './langauge-change.contribution';
import { FileDropContribution } from './file-drop.contribution';
import { FileDropService } from './file-drop.service';
import { IFileDropFrontendServiceToken, FileDropServicePath } from '../common';

@Injectable()
export class ClientAddonModule extends BrowserModule {
  providers = [
    LanguageChangeHintContribution,
    FileSearchContribution,
    StatusBarContribution,
    ToolbarCustomizeContribution,
    FileDropContribution,
    {
      token: IFileDropFrontendServiceToken,
      useClass: FileDropService,
    },
  ];

  backServices = [
    {
      servicePath: FileDropServicePath,
    },
  ];
}
