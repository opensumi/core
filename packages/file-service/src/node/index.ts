import { Injectable, Injector } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import {
  DiskFileServicePath,
  FileServicePath,
  FileSystemProvider,
  IDiskFileProvider,
  IFileService,
  IShadowFileProvider,
  ShadowFileServicePath,
} from '../common';
import { DiskFileServiceProtocol } from '../common/protocols/disk-file-service';

import { DiskFileSystemProvider } from './disk-file-system.provider';
import { getSafeFileservice } from './file-service';
import { WatcherProcessManagerImpl, WatcherProcessManagerToken } from './watcher-process-manager';

export * from './file-service';

const fsInstanceMap: Map<Injector, FileSystemProvider> = new Map();
export function getFileservice(injector: Injector, providerToken: string | symbol | Function): FileSystemProvider {
  if (fsInstanceMap.get(injector)) {
    return fsInstanceMap.get(injector)!;
  }
  const fileService = injector.get(providerToken) as FileSystemProvider;
  fsInstanceMap.set(injector, fileService);
  return fileService;
}

@Injectable()
export class FileServiceModule extends NodeModule {
  providers = [
    { token: IFileService, useFactory: (injector: Injector) => getSafeFileservice(injector) },
    { token: IDiskFileProvider, useFactory: (injector: Injector) => getFileservice(injector, DiskFileSystemProvider) },
    { token: WatcherProcessManagerToken, useClass: WatcherProcessManagerImpl },
  ];

  backServices = [
    {
      servicePath: DiskFileServicePath,
      token: IDiskFileProvider,
      protocol: DiskFileServiceProtocol,
    },
    {
      servicePath: ShadowFileServicePath,
      token: IShadowFileProvider,
    },
    {
      servicePath: FileServicePath,
      token: IFileService,
    },
  ];
}
