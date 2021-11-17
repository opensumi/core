import * as monaco from '@ide-framework/monaco-editor-core/esm/vs/editor/editor.api';

import { partialMock } from './common/util';

export type TokensProvider = monaco.languages.TokensProvider;
export type EncodedTokensProvider = monaco.languages.EncodedTokensProvider;
export type ReferenceProvider = monaco.languages.ReferenceProvider;
export type RenameProvider = monaco.languages.RenameProvider;
export type SignatureHelpProvider = monaco.languages.SignatureHelpProvider;
export type HoverProvider = monaco.languages.HoverProvider;
export type DocumentSymbolProvider = monaco.languages.DocumentSymbolProvider;
export type DocumentHighlightProvider = monaco.languages.DocumentHighlightProvider;
export type DefinitionProvider = monaco.languages.DefinitionProvider;
export type ImplementationProvider = monaco.languages.ImplementationProvider;
export type TypeDefinitionProvider = monaco.languages.TypeDefinitionProvider;
export type CodeLensProvider = monaco.languages.CodeLensProvider;
export type CodeActionProvider = monaco.languages.CodeActionProvider;
export type DocumentFormattingEditProvider = monaco.languages.DocumentFormattingEditProvider;
export type DocumentRangeFormattingEditProvider = monaco.languages.DocumentRangeFormattingEditProvider;
export type OnTypeFormattingEditProvider = monaco.languages.OnTypeFormattingEditProvider;
export type LinkProvider = monaco.languages.LinkProvider;
export type CompletionItemProvider = monaco.languages.CompletionItemProvider;
export type DocumentColorProvider = monaco.languages.DocumentColorProvider;
export type FoldingRangeProvider = monaco.languages.FoldingRangeProvider;

export interface SelectionRangeProvider {
  provideSelectionRanges(model, position, token): Promise<{
    range: monaco.Range;
  }[][]>;
}
export type IDisposable = monaco.IDisposable;

export const mockFeatureProviderRegistry: Map<string, any> = new Map();

export function createMockedMonacoLanguageApi(): typeof monaco.languages {
  const languageRegistry: Map<string, monaco.languages.ILanguageExtensionPoint> = new Map();
  const mockDisposable: IDisposable = { dispose() {} };
  const mockedMonacoEditorApi: Partial<typeof monaco.languages> = {
    onLanguage: (languageId, callback) => {
      const timerId = setTimeout(() => {
        callback();
      }, 2000);
      return {
        dispose: () => clearTimeout(timerId),
      };
    },
    register: (language) => {
      languageRegistry.set(language.id, language);
    },
    getEncodedLanguageId: (language) => {
      return 23;
    },
    getLanguages: () => {
      const languages: monaco.languages.ILanguageExtensionPoint[] = [];
      for (const value of languageRegistry.values()) {
        languages.push(value);
      }
      return languages;
    },

    setTokensProvider(languageId: string, provider: TokensProvider | EncodedTokensProvider | Thenable<TokensProvider | EncodedTokensProvider>): IDisposable {
      mockFeatureProviderRegistry.set('setTokensProvider', provider);
      return mockDisposable;
    },
    registerReferenceProvider(languageId: string, provider: ReferenceProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerReferenceProvider', provider);
      return mockDisposable;
    },
    registerRenameProvider(languageId: string, provider: RenameProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerRenameProvider', provider);
      return mockDisposable;
    },
    registerSignatureHelpProvider(languageId: string, provider: SignatureHelpProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerSignatureHelpProvider', provider);
      return mockDisposable;
    },
    registerHoverProvider(languageId: string, provider: HoverProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerHoverProvider', provider);
      return mockDisposable;
    },
    registerDocumentSymbolProvider(languageId: string, provider: DocumentSymbolProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerDocumentSymbolProvider', provider);
      return mockDisposable;
    },
    registerDocumentHighlightProvider(languageId: string, provider: DocumentHighlightProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerDocumentHighlightProvider', provider);
      return mockDisposable;
    },
    registerDefinitionProvider(languageId: string, provider: DefinitionProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerDefinitionProvider', provider);
      return mockDisposable;
    },
    registerImplementationProvider(languageId: string, provider: ImplementationProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerImplementationProvider', provider);
      return mockDisposable;
    },
    registerTypeDefinitionProvider(languageId: string, provider: TypeDefinitionProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerTypeDefinitionProvider', provider);
      return mockDisposable;
    },
    registerCodeLensProvider(languageId: string, provider: CodeLensProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerCodeLensProvider', provider);
      return mockDisposable;
    },
    registerCodeActionProvider(languageId: string, provider: CodeActionProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerCodeActionProvider', provider);
      return mockDisposable;
    },
    registerDocumentFormattingEditProvider(languageId: string, provider: DocumentFormattingEditProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerDocumentFormattingEditProvider', provider);
      return mockDisposable;
    },
    registerDocumentRangeFormattingEditProvider(languageId: string, provider: DocumentRangeFormattingEditProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerDocumentRangeFormattingEditProvider', provider);
      return mockDisposable;
    },
    registerOnTypeFormattingEditProvider(languageId: string, provider: OnTypeFormattingEditProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerOnTypeFormattingEditProvider', provider);
      return mockDisposable;
    },
    registerLinkProvider(languageId: string, provider: LinkProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerLinkProvider', provider);
      return mockDisposable;
    },
    registerCompletionItemProvider(languageId: string, provider: CompletionItemProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerCompletionItemProvider', provider);
      return mockDisposable;
    },
    registerColorProvider(languageId: string, provider: DocumentColorProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerColorProvider', provider);
      return mockDisposable;
    },
    registerFoldingRangeProvider(languageId: string, provider: FoldingRangeProvider): IDisposable {
      mockFeatureProviderRegistry.set('registerFoldingRangeProvider', provider);
      return mockDisposable;
    },
  };

  return partialMock('monaco.editor', mockedMonacoEditorApi);
}
