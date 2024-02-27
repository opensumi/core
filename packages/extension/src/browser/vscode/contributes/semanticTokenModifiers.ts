import { Autowired, Injectable } from '@opensumi/di';
import { ILogger, LifeCyclePhase } from '@opensumi/ide-core-common';
import { ISemanticTokenRegistry } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';

import {
  Contributes,
  LifeCycle,
  SemanticTokenModifierSchema,
  VSCodeContributePoint,
  validateTypeOrModifier,
} from '../../../common';

@Injectable()
@Contributes('semanticTokenModifiers')
@LifeCycle(LifeCyclePhase.Ready)
export class SemanticTokenModifiersContributionPoint extends VSCodeContributePoint<SemanticTokenModifierSchema> {
  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(ISemanticTokenRegistry)
  protected readonly semanticTokenRegistry: ISemanticTokenRegistry;

  contribute() {
    for (const contrib of this.contributesMap) {
      const { contributes } = contrib;
      if (!Array.isArray(contributes)) {
        this.logger.warn("'configuration.semanticTokenTypes' must be an array");
        return;
      }

      for (const contrib of contributes) {
        if (validateTypeOrModifier(contrib, 'semanticTokenModifier', this.logger)) {
          this.semanticTokenRegistry.registerTokenModifier(contrib.id, contrib.description);
        }
      }
    }
  }
}
