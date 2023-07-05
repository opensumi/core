import { Injectable, Autowired } from '@opensumi/di';
import { IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';
import { LifeCyclePhase, IJSONSchema, localize } from '@opensumi/ide-core-common';
import { SCMService } from '@opensumi/ide-scm';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';

@Injectable()
@Contributes('scm')
@LifeCycle(LifeCyclePhase.Starting)
export class SCMContributionPoint extends VSCodeContributePoint<any> {
  @Autowired(SCMService)
  private readonly scmService: SCMService;

  static schema: IJSONSchema = {
    description: localize('sumiContributes.scm'),
    type: 'object',
    defaultSnippets: [
      {
        body: {
          additional: {
            input: {},
          },
        },
      },
    ],
    properties: {
      additional: {
        type: 'object',
        description: localize('sumiContributes.scm.additional'),
        properties: {
          input: {
            type: 'object',
            description: localize('sumiContributes.scm.additional.input'),
          },
        },
      },
    },
  };

  contribute() {
    for (const contrib of this.contributesMap) {
      const { contributes } = contrib;

      if (contributes.additional) {
        const { additional } = contributes;

        if (!additional.input) {
          return;
        }

        const { input } = additional;

        /**
         * addonBefore 和 addonAfter 交给 AbstractViewExtProcessService 处理
         */
        if (input.addonAfter || input.addonBefore) {
          return;
        }

        this.scmService.setInputProps(input);
      }
    }
  }
}
