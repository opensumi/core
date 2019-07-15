import { NodeModule } from '@ali/ide-core-node';
import { FileSystemNodeOptions, FileService } from './file-service';
import { IFileService } from '../common/index';
import { Injectable } from '@ali/common-di';
export * from './file-service';
import { FileServicePath } from '../common';
@Injectable()
export class FileServiceModule extends NodeModule {
  providers = [
    { token: 'FileServiceOptions', useValue: FileSystemNodeOptions.DEFAULT },
    { token: IFileService, useClass: FileService },
  ];

  backServices = [
    {
      servicePath: FileServicePath,
      token: IFileService,
    },
  ];
}
