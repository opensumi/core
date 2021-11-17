import { Injectable, Provider } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';

import { FileSystemEditorResourceContribution, FileSystemEditorComponentContribution } from '@ide-framework/ide-file-scheme/lib/browser/file-scheme.contribution';
import { IFileSchemeDocClient } from '@ide-framework/ide-file-scheme';

import { FileSchemeDocClientService } from './doc-client';

@Injectable()
export class BrowserFileSchemeModule extends BrowserModule {
  providers: Provider[] = [
    FileSystemEditorResourceContribution,
    FileSystemEditorComponentContribution,
    {
      token: IFileSchemeDocClient,
      useClass: FileSchemeDocClientService,
    },
  ];
}
