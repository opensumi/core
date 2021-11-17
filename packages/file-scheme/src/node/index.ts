import { Injectable } from '@ide-framework/common-di';
import { NodeModule } from '@ide-framework/ide-core-node';

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
