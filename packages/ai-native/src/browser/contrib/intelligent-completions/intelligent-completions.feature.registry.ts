import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { InlineEditProvider } from '@opensumi/ide-monaco';

import { ICodeEditsProvider, IIntelligentCompletionProvider, IIntelligentCompletionsRegistry } from '../../types';

@Injectable()
export class IntelligentCompletionsRegistry extends Disposable implements IIntelligentCompletionsRegistry {
  private inlineCompletionsProvider: IIntelligentCompletionProvider | undefined;
  private codeEditsProvider: ICodeEditsProvider | undefined;
  private inlineEditProvider: InlineEditProvider | undefined;

  registerIntelligentCompletionProvider(provider: IIntelligentCompletionProvider): void {
    this.inlineCompletionsProvider = provider;
  }

  registerInlineCompletionsProvider(provider: IIntelligentCompletionProvider): void {
    this.inlineCompletionsProvider = provider;
  }

  registerInlineEditProvider(provider: InlineEditProvider): void {
    this.inlineEditProvider = provider;
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

  getInlineEditProvider(): InlineEditProvider | undefined {
    // TODO: 支持模块内调用
    return this.inlineEditProvider;
  }
}
