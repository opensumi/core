import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, ExtensionDocumentDataManager } from '../../common';
import { ExtHostLanguages } from './ext.host.language';
import { DocumentSelector, HoverProvider, Disposable, CompletionItemProvider, DefinitionProvider, TypeDefinitionProvider, FoldingRangeProvider, DocumentColorProvider, DocumentHighlightProvider, OnTypeFormattingEditProvider, DiagnosticCollection, CodeLensProvider, CodeActionProvider, CodeActionProviderMetadata, DocumentRangeFormattingEditProvider, ImplementationProvider } from 'vscode';

export function createLanguagesApiFactory(rpcProtocol: IRPCProtocol, extDoc: ExtensionDocumentDataManager) {

  const extHostLanguages = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostLanguages, new ExtHostLanguages(rpcProtocol, extDoc));

  return {
    registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
      return extHostLanguages.registerHoverProvider(selector, provider);
    },
    registerCompletionItemProvider(selector: DocumentSelector, provider: CompletionItemProvider, triggerCharacters: string[]): Disposable {
      return extHostLanguages.registerCompletionItemProvider(selector, provider, triggerCharacters);
    },
    registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable {
      return extHostLanguages.registerDefinitionProvider(selector, provider);
    },
    registerTypeDefinitionProvider(selector: DocumentSelector, provider: TypeDefinitionProvider): Disposable {
      return extHostLanguages.registerTypeDefinitionProvider(selector, provider);
    },
    registerFoldingRangeProvider(selector: DocumentSelector, provider: FoldingRangeProvider): Disposable {
      return extHostLanguages.registerFoldingRangeProvider(selector, provider);
    },
    registerColorProvider(selector: DocumentSelector, provider: DocumentColorProvider): Disposable {
      return extHostLanguages.registerColorProvider(selector, provider);
    },
    registerDocumentHighlightProvider(selector: DocumentSelector, provider: DocumentHighlightProvider): Disposable {
      return extHostLanguages.registerDocumentHighlightProvider(selector, provider);
    },
    registerDocumentRangeFormattingEditProvider(selector: DocumentSelector, provider: DocumentRangeFormattingEditProvider): Disposable {
      return extHostLanguages.registerDocumentRangeFormattingEditProvider(selector, provider);
    },
    registerOnTypeFormattingEditProvider(
      selector: DocumentSelector,
      provider: OnTypeFormattingEditProvider,
      firstTriggerCharacter: string,
      ...moreTriggerCharacters: string[]
    ): Disposable {
      return extHostLanguages.registerOnTypeFormattingEditProvider(selector, provider, [firstTriggerCharacter].concat(moreTriggerCharacters));
    },
    registerCodeLensProvider(selector: DocumentSelector, provider: CodeLensProvider): Disposable {
      return extHostLanguages.registerCodeLensProvider(selector, provider);
    },
    registerCodeActionsProvider(selector: DocumentSelector, provider: CodeActionProvider, metadata?: CodeActionProviderMetadata): Disposable {
      return extHostLanguages.registerCodeActionsProvider(selector, provider, null, metadata);
    },
    createDiagnosticCollection(name?: string): DiagnosticCollection {
      return extHostLanguages.createDiagnosticCollection(name);
    },
    registerImplementationProvider(selector: DocumentSelector, provider: ImplementationProvider): Disposable {
      return extHostLanguages.registerImplementationProvider(selector, provider);
    },
  };
}
