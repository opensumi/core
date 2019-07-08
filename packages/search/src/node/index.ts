import { Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { FileSearchService } from './file-search-service';
import { IFileSearchService, FileSearchServicePath } from '../common/';

@Injectable()
export class SearchModule extends NodeModule {
  providers = [{
    token: IFileSearchService,
    useClass: FileSearchService,
  }];

  backServices = [{
    servicePath: FileSearchServicePath,
    token: IFileSearchService,
  }];
}
