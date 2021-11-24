import { Provider, Injectable } from '@opensumi/common-di';
import { NodeModule } from '@opensumi/ide-core-node';
import { FileDropService } from './file-drop.service';
import { IFileDropServiceToken, FileDropServicePath } from '../common';

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
