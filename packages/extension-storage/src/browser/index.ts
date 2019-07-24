import { ExtensionStorageServerPath, IExtensionStorageService } from '../common';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { ExtensionStorageService } from './storage.service';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class WorkspaceModule extends BrowserModule {
  providers: Provider[] = [{
    token: IExtensionStorageService,
    useClass: ExtensionStorageService,
  }];

  // 依赖 Node 服务
  backServices = [{
    servicePath: ExtensionStorageServerPath,
  }];
}

export * from './storage.service';
