import { Provider, Injectable } from '@opensumi/di';
import { BackServiceWithProtocol, BrowserModule } from '@opensumi/ide-core-browser';

import {
  IFileServiceClient,
  IBrowserFileSystemRegistry,
  IDiskFileProvider,
  IShadowFileProvider,
} from '../common/index';
import { DiskFileServiceProtocol } from '../common/protocol';

import { FileServiceClient, BrowserFileSystemRegistryImpl } from './file-service-client';
import { FileServiceContribution } from './file-service-contribution';
import { DiskFsProviderClient } from './file-service-provider-client';
import { ShadowFileSystemProvider } from './shadow-file-system.provider';

@Injectable()
export class FileServiceClientModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IFileServiceClient,
      useClass: FileServiceClient,
    },
    {
      token: IBrowserFileSystemRegistry,
      useClass: BrowserFileSystemRegistryImpl,
    },
    {
      token: IDiskFileProvider,
      useClass: DiskFsProviderClient,
    },
    {
      token: IShadowFileProvider,
      useClass: ShadowFileSystemProvider,
    },
    FileServiceContribution,
  ];

  backServicesWithProtocol: BackServiceWithProtocol[] = [
    {
      protocol: DiskFileServiceProtocol,
      clientToken: IDiskFileProvider,
    },
  ];
}
