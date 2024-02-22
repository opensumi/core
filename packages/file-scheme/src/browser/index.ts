import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { FileSchemeDocNodeServicePath, IFileSchemeDocClient } from '../common';

import { FileSchemeDocClientService } from './file-scheme-doc.client';
import {
  FileSystemEditorComponentContribution,
  FileSystemEditorResourceContribution,
} from './file-scheme.contribution';

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
