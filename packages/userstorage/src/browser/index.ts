import * as React from 'react';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { UserStorageServiceFilesystemImpl } from './user-storage-service-filesystem';
import { UserStorageService } from './user-storage-service';
import { UserStorageResolver } from './user-storage-contribution';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class UserstorageModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: UserStorageService,
      useClass: UserStorageServiceFilesystemImpl,
    },
    UserStorageResolver,
  ];
}

export * from './user-storage-service';
export * from './user-storage-uri';
export * from './user-storage-service-filesystem';
