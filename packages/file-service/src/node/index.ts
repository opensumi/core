import { Injectable, Injector } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { FileServicePath, FileSystemProvider, IDiskFileProvider, IFileService } from '../common';

import { DiskFileSystemProvider } from './disk-file-system.provider';
import { DiskFileRemoteService } from './disk-file.remote-service';
import { FileChangeCollectionManager } from './file-change-collection';
import { getSafeFileservice } from './file-service';

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
    // 单例 FileChangeCollectionManager
    {
      token: FileChangeCollectionManager,
      useClass: FileChangeCollectionManager,
    },
  ];

  remoteServices = [DiskFileRemoteService];

  backServices = [
    {
      servicePath: FileServicePath,
      token: IFileService,
    },
  ];
}
