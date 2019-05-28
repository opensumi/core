import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { servicePath as FileServicePath } from '../common/index';
import {FileServiceClient} from './file-service-client';

@Injectable()
export class FileServiceClientModule extends BrowserModule {
  providers: Provider[] = [];

  // 依赖 fileService 服务
  backServices = [{
    servicePath: FileServicePath,
    clientToken: FileServiceClient,
  }];
}
