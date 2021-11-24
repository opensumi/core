import { Injectable, Autowired } from '@ide-framework/common-di';
import { ILogger } from '@ide-framework/ide-core-common/lib/log';
import { ISemanticTokenRegistry } from '@ide-framework/ide-theme/lib/common/semantic-tokens-registry';
import { VSCodeContributePoint, Contributes, SemanticTokenScopesSchema } from '../../../common';

@Injectable()
@Contributes('semanticTokenScopes')
export class SemanticTokenScopesContributionPoint extends VSCodeContributePoint<SemanticTokenScopesSchema> {

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(ISemanticTokenRegistry)
  protected readonly semanticTokenRegistry: ISemanticTokenRegistry;

  contribute() {
    if (!Array.isArray(this.json)) {
      this.logger.warn("'configuration.semanticTokenScopes' must be an array");
      return;
    }
    for (const contrib of this.json) {
      if (!contrib.scopes || typeof contrib.scopes !== 'object') {
        this.logger.warn("'configuration.semanticTokenScopes.scopes' must be defined as an object");
        continue;
      }
      if (contrib.language && typeof contrib.language !== 'string') {
        this.logger.warn("'configuration.semanticTokenScopes.language' must be as a string");
        continue;
      }

      /* tslint:disable forin*/
      for (const selector in contrib.scopes) {
        const scopes = contrib.scopes[selector];
        if (!Array.isArray(scopes) || scopes.some((l) => typeof l !== 'string')) {
          this.logger.error("'configuration.semanticTokenScopes.scopes' values must be an array of strings");
          continue;
        }
        try {
          const parsedSelector = this.semanticTokenRegistry.parseTokenSelector(selector, contrib.language);
          this.semanticTokenRegistry.registerTokenStyleDefault(
            parsedSelector,
            {
              scopesToProbe: scopes.map((s) => s.split(' ')),
            },
          );
        } catch (err) {
          this.logger.error(`configuration.semanticTokenScopes.scopes': Problems parsing selector ${selector}.`);
        }
      }
    }
  }

}
