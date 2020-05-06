import { NodeModule } from '@ali/ide-core-node';
import { FileSystemNodeOptions, getSafeFileservice } from './file-service';
import { IFileService } from '../common/index';
import { Injectable, Injector } from '@ali/common-di';
export * from './file-service';
import { FileServicePath } from '../common';

@Injectable()
export class FileServiceModule extends NodeModule {

  providers = [
    { token: 'FileServiceOptions', useValue: FileSystemNodeOptions.DEFAULT },
    { token: IFileService, useFactory: (injector: Injector) => getSafeFileservice(injector)},
  ];

  backServices = [
    {
      servicePath: FileServicePath,
      token: IFileService,
    },
  ];
}
