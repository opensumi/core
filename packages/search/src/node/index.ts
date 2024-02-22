import { Injectable } from '@opensumi/di';
import { NodeModule } from '@opensumi/ide-core-node';

import { ContentSearchServerPath, IContentSearchServer } from '../common';

import { ContentSearchService } from './content-search.service';

@Injectable()
export class SearchModule extends NodeModule {
  providers = [
    {
      token: IContentSearchServer,
      useClass: ContentSearchService,
    },
  ];

  backServices = [
    {
      servicePath: ContentSearchServerPath,
      token: IContentSearchServer,
    },
  ];
}
