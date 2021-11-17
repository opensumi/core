import { Provider, Injectable } from '@ide-framework/common-di';
import { IFileServiceClient, IBrowserFileSystemRegistry, IDiskFileProvider, IShadowFileProvider, DiskFileServicePath } from '../common/index';
import { FileServiceClient, BrowserFileSystemRegistryImpl } from './file-service-client';
import { BrowserModule } from '@ide-framework/ide-core-browser';
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

  // 依赖 fileService 服务
  backServices = [
    {
      servicePath: DiskFileServicePath,
      clientToken: IDiskFileProvider,
    },
  ];
}
