import { Provider, Injectable } from '@ali/common-di';
import { IFileServiceClient, IBrowserFileSystemRegistry, IDiskFileProvider, ShadowFileServicePath, IShadowFileProvider, DiskFileServicePath } from '../common/index';
import { FileServiceClient, BrowserFileSystemRegistryImpl } from './file-service-client';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileResourceResolver } from './file-service-contribution';
import { DiskFsProviderClient, ShadowFsProviderClient } from './file-service-provider-client';

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
      useClass: ShadowFsProviderClient,
    },
    FileResourceResolver,
  ];

  // 依赖 fileService 服务
  backServices = [
    {
      servicePath: DiskFileServicePath,
      clientToken: IDiskFileProvider,
    },
    {
      servicePath: ShadowFileServicePath,
      clientToken: IShadowFileProvider,
    },
  ];
}
