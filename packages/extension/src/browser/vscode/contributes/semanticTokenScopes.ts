import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-common';
import { ILogger } from '@opensumi/ide-core-common/lib/log';
import { ISemanticTokenRegistry } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';

import { VSCodeContributePoint, Contributes, SemanticTokenScopesSchema, LifeCycle } from '../../../common';

@Injectable()
@Contributes('semanticTokenScopes')
@LifeCycle(LifeCyclePhase.Ready)
export class SemanticTokenScopesContributionPoint extends VSCodeContributePoint<SemanticTokenScopesSchema> {
  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(ISemanticTokenRegistry)
  protected readonly semanticTokenRegistry: ISemanticTokenRegistry;

  contribute() {
    for (const contrib of this.contributesMap) {
      const { contributes } = contrib;
      if (!Array.isArray(contributes)) {
        this.logger.warn("'configuration.semanticTokenScopes' must be an array");
        return;
      }
      for (const contrib of contributes) {
        if (!contrib.scopes || typeof contrib.scopes !== 'object') {
          this.logger.warn("'configuration.semanticTokenScopes.scopes' must be defined as an object");
          continue;
        }
        if (contrib.language && typeof contrib.language !== 'string') {
          this.logger.warn("'configuration.semanticTokenScopes.language' must be as a string");
          continue;
        }

        // eslint-disable-next-line guard-for-in
        for (const selector in contrib.scopes) {
          const scopes = contrib.scopes[selector];
          if (!Array.isArray(scopes) || scopes.some((l) => typeof l !== 'string')) {
            this.logger.error("'configuration.semanticTokenScopes.scopes' values must be an array of strings");
            continue;
          }
          try {
            const parsedSelector = this.semanticTokenRegistry.parseTokenSelector(selector, contrib.language);
            this.semanticTokenRegistry.registerTokenStyleDefault(parsedSelector, {
              scopesToProbe: scopes.map((s) => s.split(' ')),
            });
          } catch (err) {
            this.logger.error(`configuration.semanticTokenScopes.scopes': Problems parsing selector ${selector}.`);
          }
        }
      }
    }
  }
}
