import { Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';

import { IFileSchemeDocNodeService, FileSchemeDocNodeServicePath } from '../common';
import { FileSchemeDocNodeServiceImpl } from './file-scheme-doc.service';

@Injectable()
export class FileSchemeNodeModule extends NodeModule {
  providers = [
    {
      token: IFileSchemeDocNodeService,
      useClass: FileSchemeDocNodeServiceImpl,
    },
  ];

  backServices = [
    {
      servicePath: FileSchemeDocNodeServicePath,
      token: IFileSchemeDocNodeService,
    },
  ];
}
