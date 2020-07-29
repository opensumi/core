import { Injectable, Provider } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { FileSystemEditorResourceContribution, FileSystemEditorComponentContribution } from '@ali/ide-file-scheme/lib/browser/file-scheme.contribution';
import { IFileSchemeDocClient } from '@ali/ide-file-scheme';

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
