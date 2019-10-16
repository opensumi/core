import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { WorkspaceStorageServerPath, GlobalStorageServerPath } from '../common';
import { DatabaseStorageContribution } from './storage.contribution';

@Injectable()
export class StorageModule extends BrowserModule {
  providers: Provider[] = [
    DatabaseStorageContribution,
  ];

  // 依赖 Node 服务
  backServices = [{
    servicePath: WorkspaceStorageServerPath,
  }, {
    servicePath: GlobalStorageServerPath,
  }];
}
