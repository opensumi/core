import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import {
  FileSystemEditorResourceContribution,
  FileSystemEditorComponentContribution,
} from './file-scheme.contribution';
import { FileSchemeDocNodeServicePath, IFileSchemeDocClient } from '../common';
import { FileSchemeDocClientService } from './file-scheme-doc.client';

@Injectable()
export class FileSchemeModule extends BrowserModule {
  providers: Provider[] = [
    FileSystemEditorResourceContribution,
    FileSystemEditorComponentContribution,
    {
      token: IFileSchemeDocClient,
      useClass: FileSchemeDocClientService,
    },
  ];

  backServices = [
    {
      servicePath: FileSchemeDocNodeServicePath,
    },
  ];
}
