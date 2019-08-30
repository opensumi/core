import { Provider, Injectable } from '@ali/common-di';
import { FileServicePath, IFileServiceClient } from '../common/index';
import { FileServiceClient } from './file-service-client';
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
