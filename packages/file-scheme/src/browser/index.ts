import { Injectable, Provider } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

import { FileSystemEditorResourceContribution, FileSystemEditorComponentContribution } from './file-scheme.contribution';
import { FileSchemeDocNodeServicePath } from '../common';

@Injectable()
export class FileSchemeModule extends BrowserModule {
  providers: Provider[] = [
    FileSystemEditorResourceContribution,
    FileSystemEditorComponentContribution,
  ];

  backServices = [
    {
      servicePath: FileSchemeDocNodeServicePath,
    },
  ];
}
