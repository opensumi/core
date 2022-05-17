import os from 'os';

import {
  HashCalculateServiceImpl,
  IHashCalculateService,
} from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { AppConfig, INodeLogger, getDebugLogger, path } from '@opensumi/ide-core-node';
import { createNodeInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { IExtensionStoragePathServer } from '@opensumi/ide-extension-storage/lib/common';
import { IFileService, IDiskFileProvider } from '@opensumi/ide-file-service/lib/common';
import { FileSystemNodeOptions, FileService } from '@opensumi/ide-file-service/lib/node';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';

import { IExtensionNodeClientService, IExtensionNodeService } from '../../src/common';
import { ExtensionNodeServiceImpl } from '../../src/node/extension.service';
import { ExtensionServiceClientImpl } from '../../src/node/extension.service.client';

export const extensionDir = path.join(__dirname, '../../__mocks__/extensions');

export const getBaseInjector = () => {
  const injector = createNodeInjector([]);
  injector.addProviders(
    {
      token: AppConfig,
      useValue: {
        marketplace: {
          extensionDir,
          ignoreId: [],
        },
      },
    },
    {
      token: INodeLogger,
      useValue: getDebugLogger(),
    },
    {
      token: IFileService,
      useClass: FileService,
    },
    {
      token: IDiskFileProvider,
      useClass: DiskFileSystemProvider,
    },
    {
      token: 'FileServiceOptions',
      useValue: FileSystemNodeOptions.DEFAULT,
    },
    {
      token: IExtensionStoragePathServer,
      useValue: {
        getLastStoragePath: () => Promise.resolve(path.join(os.homedir(), '.sumi-extension-test', 'workspace-storage')),
      },
    },
    {
      token: IExtensionNodeService,
      useClass: ExtensionNodeServiceImpl,
    },
    {
      token: IExtensionNodeClientService,
      useClass: ExtensionServiceClientImpl,
    },
    {
      token: IHashCalculateService,
      useClass: HashCalculateServiceImpl,
    },
  );
  return injector;
};
