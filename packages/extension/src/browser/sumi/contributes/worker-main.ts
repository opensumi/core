import { Injectable } from '@opensumi/di';
import { localize } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes } from '../../../common';

@Injectable()
@Contributes('workerMain')
export class WorkerMainContributionPoint extends VSCodeContributePoint<{ [key in string]: string }> {

  static schema = {
    type: 'string',
    defaultSnippets: [
      {
        body: './out/worker/index.js',
      },
    ],
    description: localize('kaitianContributes.workerMain'),
  };

  contribute() {
    // do nothing
  }
}
