import { Injectable, Injector, Provider } from '@opensumi/di';
import { BrowserModule, FileServiceClientToken } from '@opensumi/ide-core-browser';

import { DiskFileServicePath, IBrowserFileSystemRegistry, IDiskFileProvider, IShadowFileProvider } from '../common';
import { DiskFileServiceProtocol } from '../common/protocols/disk-file-service';

import { BrowserFileSystemRegistryImpl, FileServiceClient } from './file-service-client';
import { FileServiceContribution } from './file-service-contribution';
import { DiskFsProviderClient } from './file-service-provider-client';
import { ShadowFileSystemProvider } from './shadow-file-system.provider';

@Injectable()
export class FileServiceClientModule extends BrowserModule {
  providers: Provider[] = [
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

  preferences = (inject: Injector) => {
    inject.overrideProviders({
      token: FileServiceClientToken,
      useClass: FileServiceClient,
    });
  };

  // 依赖 fileService 服务
  backServices = [
    {
      servicePath: DiskFileServicePath,
      clientToken: IDiskFileProvider,
      protocol: DiskFileServiceProtocol,
    },
  ];
}
