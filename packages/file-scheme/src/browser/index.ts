import { Injectable, Provider } from '@ali/common-di';
import { FileSystemEditorContribution } from './file-scheme.contribution';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileSchemeDocNodeServicePath } from '../common';

@Injectable()
export class FileSchemeModule extends BrowserModule {
  providers: Provider[] = [
    FileSystemEditorContribution,
  ];

  backServices = [
    {
      servicePath: FileSchemeDocNodeServicePath,
    },
  ];
}
