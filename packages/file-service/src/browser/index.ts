import { Provider, Injectable } from '@ali/common-di';
import { FileServicePath, FileWatcherServicePath } from '../common/index';
import { FileServiceClient } from './file-service-client';
import { FileServiceWatcherClient } from './file-service-watcher-client';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileResourceResolver } from './file-service-contribution';
@Injectable()
export class FileServiceClientModule extends BrowserModule {
  providers: Provider[] = [
    FileResourceResolver,
  ];

  // 依赖 fileService 服务
  backServices = [
    {
      servicePath: FileServicePath,
      clientToken: FileServiceClient,
    },
    {
      servicePath: FileWatcherServicePath,
      clientToken: FileServiceWatcherClient,
    },
  ];
}
