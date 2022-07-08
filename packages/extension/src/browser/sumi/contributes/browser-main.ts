import { Injectable } from '@opensumi/di';
import { localize } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes } from '../../../common';

@Injectable()
@Contributes('browserMain')
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
