import { Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { FileSchemeDocNodeServicePath, IFileSchemeDocNodeService } from '../common';

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
