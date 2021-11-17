import { Injectable } from '@ide-framework/common-di';
import { NodeModule } from '@ide-framework/ide-core-node';
import { ContentSearchService } from './content-search.service';
import { IContentSearchServer, ContentSearchServerPath } from '../common';

@Injectable()
export class SearchModule extends NodeModule {
  providers = [{
    token: IContentSearchServer,
    useClass: ContentSearchService,
  }];

  backServices = [{
    servicePath: ContentSearchServerPath,
    token: IContentSearchServer,
  }];
}
