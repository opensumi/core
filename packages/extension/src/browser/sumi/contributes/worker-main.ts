import { Injectable } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { localize } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';

@Injectable()
@Contributes('workerMain')
@LifeCycle(LifeCyclePhase.Ready)
export class WorkerMainContributionPoint extends VSCodeContributePoint<{ [key in string]: string }> {
  static schema = {
    type: 'string',
    defaultSnippets: [
      {
        body: './out/worker/index.js',
      },
    ],
    description: localize('sumiContributes.workerMain'),
  };

  contribute() {
    // do nothing
  }
}
