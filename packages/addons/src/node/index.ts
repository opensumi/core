import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { IFileDropServiceToken, FileDropServicePath } from '../common';

import { FileDropService } from './file-drop.service';

@Injectable()
export class AddonsModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IFileDropServiceToken,
      useClass: FileDropService,
    },
  ];

  backServices = [
    {
      servicePath: FileDropServicePath,
      token: IFileDropServiceToken,
    },
  ];
}
