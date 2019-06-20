import { Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { documentService } from '../common';
import { NodeDocumentService } from './file-model';

@Injectable()
export class DocModelModule extends NodeModule {
  providers = [];
  backServices = [
    {
      servicePath: documentService,
      token: NodeDocumentService,
    },
  ];
}
