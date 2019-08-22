import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { ExtensionNodeService, ExtensionNodeServiceServerPath } from '../common';
import { ExtensionNodeServiceImpl } from './extension.service';

@Injectable()
export class FeatureExtensionServerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: ExtensionNodeService,
      useClass: ExtensionNodeServiceImpl,
    },
  ];

  backServices = [
    {
      servicePath: ExtensionNodeServiceServerPath,
      token: ExtensionNodeService,
    },
  ];
}
