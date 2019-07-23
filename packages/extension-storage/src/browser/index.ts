import { StoragePathService } from './storage-path.service';
import { StorageService } from './storage.service';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class WorkspaceModule extends BrowserModule {
  providers: Provider[] = [];

  // 依赖 Node 服务
  // backServices = [{
  //   servicePath: WorkspaceServerPath,
  // }];
}

export * from './storage-path.service';
export * from './storage.service';
