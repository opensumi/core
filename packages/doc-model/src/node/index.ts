import { Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { servicePath } from '../common';
import { NodeDocumentService } from './doc-model';

@Injectable()
export class DocModelModule extends NodeModule {
  providers = [];
  backServices = [
    {
      servicePath,
      token: NodeDocumentService,
    },
  ];
}
