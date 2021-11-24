import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { FileSystemEditorResourceContribution, FileSystemEditorComponentContribution } from '@opensumi/ide-file-scheme/lib/browser/file-scheme.contribution';
import { IFileSchemeDocClient } from '@opensumi/ide-file-scheme';

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
