import { Injectable } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { localize } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';

@Injectable()
@Contributes('viewsProxies')
@LifeCycle(LifeCyclePhase.Starting)
export class ViewsProxiesContributionPoint extends VSCodeContributePoint<{ [key in string]: string }> {
  static schema = {
    type: 'array',
    markdownDescription: localize('sumiContributes.viewsProxies'),
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
