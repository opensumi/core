import { workspaceServerPath as servicePath } from '../common';
import { WorkspaceService as  clientToken } from './workspace-service';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';

@Injectable()
export class WorkspaceModule extends BrowserModule {
  providers: Provider[] = [];

  // 依赖 fileService 服务
  backServices = [{
    servicePath,
    clientToken,
  }];
}
