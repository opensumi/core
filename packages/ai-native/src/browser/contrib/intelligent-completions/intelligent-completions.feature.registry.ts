import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { IIntelligentCompletionProvider, IIntelligentCompletionsRegistry } from '../../types';

@Injectable()
export class IntelligentCompletionsRegistry extends Disposable implements IIntelligentCompletionsRegistry {
  private provider: IIntelligentCompletionProvider | undefined;

  registerIntelligentCompletionProvier(provider: IIntelligentCompletionProvider): void {
    this.provider = provider;
  }

  getProvider(): IIntelligentCompletionProvider | undefined {
    return this.provider;
  }
}
