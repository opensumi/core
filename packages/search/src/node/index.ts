import { Injectable } from '@ali/common-di';
import { NodeModule } from '@ali/ide-core-node';
import { FileSearchService } from './file-search.service';
import { ContentSearchService } from './content-search.service';
import {
  IFileSearchService,
  IContentSearchServer,
  FileSearchServicePath,
  ContentSearchServerPath,
} from '../common/';

@Injectable()
export class SearchModule extends NodeModule {
  providers = [{
    token: IFileSearchService,
    useClass: FileSearchService,
  }, {
    token: IContentSearchServer,
    useClass: ContentSearchService,
  }];

  backServices = [{
    servicePath: FileSearchServicePath,
    token: IFileSearchService,
  }, {
    servicePath: ContentSearchServerPath,
    token: IContentSearchServer,
  }];
}
