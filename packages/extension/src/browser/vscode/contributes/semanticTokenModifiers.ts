import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { ILogger } from '@opensumi/ide-core-common';
import { ISemanticTokenRegistry } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';

import {
  VSCodeContributePoint,
  Contributes,
  SemanticTokenModifierSchema,
  validateTypeOrModifier,
  LifeCycle,
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
