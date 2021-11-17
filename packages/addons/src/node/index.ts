import { Provider, Injectable } from '@ide-framework/common-di';
import { NodeModule } from '@ide-framework/ide-core-node';
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
