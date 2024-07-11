import { Injectable } from '@opensumi/di';

import { IRenameCandidatesProviderRegistry, NewSymbolNamesProviderFn } from '../../types';

@Injectable()
export class RenameCandidatesProviderRegistry implements IRenameCandidatesProviderRegistry {
  private readonly providerMap = new Set<NewSymbolNamesProviderFn>();

  registerRenameSuggestionsProvider(provider: NewSymbolNamesProviderFn): void {
    this.providerMap.add(provider);
  }

  getRenameSuggestionsProviders(): NewSymbolNamesProviderFn[] {
    return Array.from(this.providerMap);
  }
}
