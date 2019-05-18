import { NodeModule } from '@ali/ide-core-node';
import { FileSystemNodeOptions, FileService } from './file-service';
import { Injectable } from '@ali/common-di';
export * from './file-service';
import {servicePath} from '../common/index';
import {servicePath as FileTreeServicePath} from '@ali/ide-file-tree';
@Injectable()
export class FileServiceModule extends NodeModule {
  providers = [{ token: 'FileServiceOptions', useValue: FileSystemNodeOptions.DEFAULT }];

  backServices = [
    {
      servicePath,
      token: FileService,
    },
  ];
  frontServices = [
    {
      servicePath: FileTreeServicePath,
    },
  ];
}
