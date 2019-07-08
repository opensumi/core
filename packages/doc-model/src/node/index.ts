import { Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { documentService, INodeDocumentService } from '../common';
import { NodeDocumentService } from './doc-service';

@Injectable()
export class DocModelModule extends NodeModule {
  providers = [
    {
      token: INodeDocumentService,
      useClass: NodeDocumentService,
    },
  ];
  backServices = [
    {
      token: INodeDocumentService,
      servicePath: documentService,
    },
  ];
}
