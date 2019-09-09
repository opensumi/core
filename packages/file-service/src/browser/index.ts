import { Provider, Injectable } from '@ali/common-di';
import { FileServicePath, IFileServiceClient, IBrowserFileSystemRegistry } from '../common/index';
import { FileServiceClient, BrowserFileSystemRegistryImpl } from './file-service-client';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileResourceResolver } from './file-service-contribution';
import { FileServiceExtClient } from './file-service-ext-client';

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
    FileResourceResolver,
  ];

  // 依赖 fileService 服务
  backServices = [
    {
      servicePath: FileServicePath,
      clientToken: IFileServiceClient,
    },
    {
      servicePath: FileServicePath,
      clientToken: FileServiceExtClient,
    },
  ];
}
