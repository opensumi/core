import { Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';
import { FileSearchService } from './file-search.service';
import { IFileSearchService, FileSearchServicePath } from '../common';

@Injectable()
export class FileSearchModule extends NodeModule {
  providers = [{
    token: IFileSearchService,
    useClass: FileSearchService,
  }];

  backServices = [{
    token: IFileSearchService,
    servicePath: FileSearchServicePath,
  }];
}
