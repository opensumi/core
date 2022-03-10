import { Injectable, Injector } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import {
  IFileService,
  IDiskFileProvider,
  ShadowFileServicePath,
  FileServicePath,
  IShadowFileProvider,
  FileSystemProvider,
  DiskFileServicePath,
} from '../common';

import { DiskFileSystemProvider } from './disk-file-system.provider';
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
  ];

  backServices = [
    {
      servicePath: DiskFileServicePath,
      token: IDiskFileProvider,
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
