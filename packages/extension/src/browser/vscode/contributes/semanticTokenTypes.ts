import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { ILogger } from '@opensumi/ide-core-browser/lib/logger';
import { ISemanticTokenRegistry } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';

import {
  VSCodeContributePoint,
  Contributes,
  SemanticTokenTypeSchema,
  validateTypeOrModifier,
  LifeCycle,
} from '../../../common';

@Injectable()
@Contributes('semanticTokenTypes')
@LifeCycle(LifeCyclePhase.Ready)
export class SemanticTokenTypesContributionPoint extends VSCodeContributePoint<SemanticTokenTypeSchema> {
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
        if (validateTypeOrModifier(contrib, 'semanticTokenType', this.logger)) {
          this.semanticTokenRegistry.registerTokenType(contrib.id, contrib.description, contrib.superType);
        }
      }
    }
  }
}
