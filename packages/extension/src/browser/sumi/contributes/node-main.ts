import { Injectable } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { localize } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';

@Injectable()
@Contributes('nodeMain')
@LifeCycle(LifeCyclePhase.Ready)
export class NodeMainContributionPoint extends VSCodeContributePoint<{ [key in string]: string }> {
  static schema = {
    type: 'string',
    defaultSnippets: [
      {
        body: './out/node/index.js',
      },
    ],
    description: localize('sumiContributes.nodeMain'),
  };

  contribute() {
    // do nothing
  }
}
