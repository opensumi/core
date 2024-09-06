import { Injectable } from '@opensumi/di';

import { IProblemFixProviderRegistry, NewSymbolNamesProviderFn } from '../../types';

@Injectable()
export class ProblemFixProviderRegistry implements IProblemFixProviderRegistry {
  registerHoverFixProvider(provider: NewSymbolNamesProviderFn): void {
    throw new Error('Method not implemented.');
  }

  registerFixProvider(provider: NewSymbolNamesProviderFn): void {}

  getFixProviders(): NewSymbolNamesProviderFn[] {
    return [];
  }
}
