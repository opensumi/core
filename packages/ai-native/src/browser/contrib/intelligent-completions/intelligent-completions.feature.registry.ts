import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';

import { ICodeEditsProvider, IIntelligentCompletionProvider, IIntelligentCompletionsRegistry } from '../../types';

@Injectable()
export class IntelligentCompletionsRegistry extends Disposable implements IIntelligentCompletionsRegistry {
  private inlineCompletionsProvider: IIntelligentCompletionProvider | undefined;
  private codeEditsProvider: ICodeEditsProvider | undefined;

  registerIntelligentCompletionProvider(provider: IIntelligentCompletionProvider): void {
    this.inlineCompletionsProvider = provider;
  }

  registerInlineCompletionsProvider(provider: IIntelligentCompletionProvider): void {
    this.inlineCompletionsProvider = provider;
  }

  registerCodeEditsProvider(provider: ICodeEditsProvider): void {
    this.codeEditsProvider = provider;
  }

  getInlineCompletionsProvider(): IIntelligentCompletionProvider | undefined {
    return this.inlineCompletionsProvider;
  }

  getCodeEditsProvider(): ICodeEditsProvider | undefined {
    return this.codeEditsProvider;
  }
}
