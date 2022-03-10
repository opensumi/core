import { Injectable, Autowired } from '@opensumi/di';
import { ILogger } from '@opensumi/ide-core-common';
import { ISemanticTokenRegistry } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';

import {
  VSCodeContributePoint,
  Contributes,
  SemanticTokenModifierSchema,
  validateTypeOrModifier,
} from '../../../common';

@Injectable()
@Contributes('semanticTokenModifiers')
export class SemanticTokenModifiersContributionPoint extends VSCodeContributePoint<SemanticTokenModifierSchema> {
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
      if (validateTypeOrModifier(contrib, 'semanticTokenModifier', this.logger)) {
        this.semanticTokenRegistry.registerTokenModifier(contrib.id, contrib.description);
      }
    }
  }
}
