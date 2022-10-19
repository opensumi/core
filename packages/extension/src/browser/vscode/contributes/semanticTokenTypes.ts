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
    if (!Array.isArray(this.json)) {
      this.logger.warn("'configuration.semanticTokenTypes' must be an array");
      return;
    }

    for (const contrib of this.json) {
      if (validateTypeOrModifier(contrib, 'semanticTokenType', this.logger)) {
        this.semanticTokenRegistry.registerTokenType(contrib.id, contrib.description, contrib.superType);
      }
    }
  }
}
