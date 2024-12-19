import { Autowired, Injectable } from '@opensumi/di';
import { CancellationToken, RenameCandidatesProviderRegistryToken } from '@opensumi/ide-core-common';
import { IRange, ITextModel, NewSymbolName, NewSymbolNameTriggerKind } from '@opensumi/ide-monaco';

import { IRenameCandidatesProviderRegistry } from '../../types';

@Injectable()
export class RenameSuggestionsService {
  @Autowired(RenameCandidatesProviderRegistryToken)
  private readonly renameCandidatesProviderRegistry: IRenameCandidatesProviderRegistry;

  async provideRenameSuggestions(
    model: ITextModel,
    range: IRange,
    triggerKind: NewSymbolNameTriggerKind,
    token: CancellationToken,
  ) {
    const providers = this.renameCandidatesProviderRegistry.getRenameSuggestionsProviders();

    const promises = providers.map((provider) => provider(model, range, triggerKind, token));

    const result = (await Promise.all(promises)).filter(Boolean) as NewSymbolName[][];

    return result.flat();
  }
}
