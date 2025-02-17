import { Autowired } from '@opensumi/di';
import { ClientAppContribution, Domain } from '@opensumi/ide-core-browser';

import { LLMContextService, LLMContextServiceToken } from '../../common/llm-context';

@Domain(ClientAppContribution)
export class LlmContextContribution implements ClientAppContribution {
  @Autowired(LLMContextServiceToken)
  protected readonly llmContextService: LLMContextService;

  initialize() {
    this.llmContextService.startAutoCollection();
  }
}
