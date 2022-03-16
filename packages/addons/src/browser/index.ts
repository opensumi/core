import { Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { IFileDropFrontendServiceToken, FileDropServicePath } from '../common';

import { FileDropContribution } from './file-drop.contribution';
import { FileDropService } from './file-drop.service';
import { FileSearchContribution } from './file-search.contribution';
import { LanguageChangeHintContribution } from './langauge-change.contribution';
import { StatusBarContribution } from './status-bar-contribution';
import { ToolbarCustomizeContribution } from './toolbar-customize/toolbar-customize.contribution';


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
