import { Injectable } from '@opensumi/di';
import { localize } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes } from '../../../common';

@Injectable()
@Contributes('nodeMain')
export class NodeMainContributionPoint extends VSCodeContributePoint<{ [key in string]: string }> {

  static schema = {
    type: 'string',
    defaultSnippets: [
      {
        body: './out/node/index.js',
      },
    ],
    description: localize('kaitianContributes.nodeMain'),
  };

  contribute() {
    // do nothing
  }
}
