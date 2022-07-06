import { Injectable } from '@opensumi/di';
import { localize } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes } from '../../../common';

@Injectable()
@Contributes('viewsProxies')
export class ViewsProxiesContributionPoint extends VSCodeContributePoint<{ [key in string]: string }> {

  static schema = {
    type: 'array',
    markdownDescription: localize('kaitianContributes.viewsProxies'),
    defaultSnippets: [
      {
        body: ['${1}'],
      },
    ],
    items: {
      type: 'string',
    },
  };

  contribute() {
    // do nothing
  }
}
