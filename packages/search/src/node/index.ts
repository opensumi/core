import { Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { IFileSearchService, FileSearchServicePath } from '../common';
import { IContentSearchServer, ContentSearchServerPath } from '../common';

import { ContentSearchService } from './content-search.service';
import { FileSearchService } from './file-search.service';

@Injectable()
export class SearchModule extends NodeModule {
  providers = [
    {
      token: IContentSearchServer,
      useClass: ContentSearchService,
    },
    {
      token: IFileSearchService,
      useClass: FileSearchService,
    },
  ];

  backServices = [
    {
      servicePath: ContentSearchServerPath,
      token: IContentSearchServer,
    },
    {
      servicePath: FileSearchServicePath,
      token: IFileSearchService,
    },
  ];
}
