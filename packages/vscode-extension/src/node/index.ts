import { Provider, Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { VSCodeExtensionHostDocumentServicePath } from '@ali/ide-doc-model';
import { VSCodeExtensionNodeServiceImpl } from './vscode.extension';
import {
  VSCodeExtensionNodeService,
  VSCodeExtensionNodeServiceServerPath,
  ExtensionDocumentDataManager,
} from '../common';
import { ExtensionDocumentDataManagerImpl } from './doc';

@Injectable()
export class VSCodeExtensionServerModule extends NodeModule {
  providers: Provider[] = [
    {
      token: VSCodeExtensionNodeService,
      useClass: VSCodeExtensionNodeServiceImpl,
    },
    {
      token: ExtensionDocumentDataManager,
      useClass: ExtensionDocumentDataManagerImpl,
    },
  ];

  backServices = [
    {
      servicePath: VSCodeExtensionNodeServiceServerPath,
      token: VSCodeExtensionNodeServiceImpl,
    },
    {
      servicePath: VSCodeExtensionHostDocumentServicePath,
      token: ExtensionDocumentDataManager,
    },
  ];
}
