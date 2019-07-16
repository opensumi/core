import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { VSCodeExtensionNodeServiceImpl } from './vscode.extension';
import {
  VSCodeExtensionNodeService,
  VSCodeExtensionNodeServiceServerPath,
} from '../common';

@Injectable()
export class VSCodeExtensionServerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: VSCodeExtensionNodeService,
      useClass: VSCodeExtensionNodeServiceImpl,
    },
  ];

  backServices = [
    {
      servicePath: VSCodeExtensionNodeServiceServerPath,
      token: VSCodeExtensionNodeServiceImpl,
    },
  ];
}
