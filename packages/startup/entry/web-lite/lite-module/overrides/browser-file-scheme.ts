import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { IFileSchemeDocClient } from '@opensumi/ide-file-scheme';
import {
  FileSystemEditorResourceContribution,
  FileSystemEditorComponentContribution,
} from '@opensumi/ide-file-scheme/lib/browser/file-scheme.contribution';

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
