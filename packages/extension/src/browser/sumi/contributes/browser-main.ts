import { Injectable } from '@opensumi/di';
import { localize, LifeCyclePhase } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';

@Injectable()
@Contributes('browserMain')
@LifeCycle(LifeCyclePhase.Ready)
export class BrowserMainContributionPoint extends VSCodeContributePoint<{ [key in string]: string }> {
  static schema = {
    type: 'string',
    defaultSnippets: [
      {
        body: './out/browser/index.js',
      },
    ],
    description: localize('sumiContributes.browserMain'),
  };

  contribute() {
    // do nothing
  }
}
