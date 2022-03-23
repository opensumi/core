import { Provider, Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import {
  IFileDropServiceToken,
  FileDropServicePath,
  IConnectionBackService,
  ConnectionBackServicePath,
} from '../common';

import { ConnectionRTTBackService } from './connection-rtt-service';
import { FileDropService } from './file-drop.service';

@Injectable()
export class AddonsModule extends NodeModule {
  providers: Provider[] = [
    {
      token: IFileDropServiceToken,
      useClass: FileDropService,
    },
    {
      token: IConnectionBackService,
      useClass: ConnectionRTTBackService,
    },
  ];

  backServices = [
    {
      servicePath: FileDropServicePath,
      token: IFileDropServiceToken,
    },
    {
      servicePath: ConnectionBackServicePath,
      token: IConnectionBackService,
    },
  ];
}
