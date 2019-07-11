import { Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { FileSearchService } from './file-search-service';
import { SearchInWorkspaceServer } from './search-in-workspace';
import {
  IFileSearchService,
  ISearchInWorkspaceServer,
  FileSearchServicePath,
  SearchInWorkspaceServerPath,
} from '../common/';

@Injectable()
export class SearchModule extends NodeModule {
  providers = [{
    token: IFileSearchService,
    useClass: FileSearchService,
  }, {
    token: ISearchInWorkspaceServer,
    useClass: SearchInWorkspaceServer,
  }];

  backServices = [{
    servicePath: FileSearchServicePath,
    token: IFileSearchService,
  }, {
    servicePath: SearchInWorkspaceServerPath,
    token: ISearchInWorkspaceServer,
  }];
}
