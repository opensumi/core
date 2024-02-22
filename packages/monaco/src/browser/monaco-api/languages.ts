import { FoldingRangeKind } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import { ILanguageFeaturesService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/languageFeatures';
import {
  getEncodedLanguageId,
  getLanguages,
  onLanguage,
  register,
  registerCodeActionProvider,
  registerCodeLensProvider,
  registerColorProvider,
  registerCompletionItemProvider,
  registerDeclarationProvider,
  registerDefinitionProvider,
  registerDocumentFormattingEditProvider,
  registerDocumentHighlightProvider,
  registerDocumentRangeFormattingEditProvider,
  registerDocumentSymbolProvider,
  registerFoldingRangeProvider,
  registerHoverProvider,
  registerImplementationProvider,
  registerLinkProvider,
  registerOnTypeFormattingEditProvider,
  registerReferenceProvider,
  registerRenameProvider,
  registerSelectionRangeProvider,
  registerSignatureHelpProvider,
  registerTypeDefinitionProvider,
  setLanguageConfiguration,
  setMonarchTokensProvider,
  setTokensProvider,
} from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneLanguages';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

export function createMonacoLanguageApi() {
  return Object.freeze({
    // methods and events
    register,
    getLanguages,
    onLanguage,
    getEncodedLanguageId,
    // language features and provider methods
    setLanguageConfiguration,
    setTokensProvider,
    setMonarchTokensProvider,
    registerReferenceProvider,
    registerRenameProvider,
    registerSignatureHelpProvider,
    registerHoverProvider,
    registerDocumentSymbolProvider,
    registerDocumentHighlightProvider,
    registerDefinitionProvider,
    registerImplementationProvider,
    registerTypeDefinitionProvider,
    registerCodeLensProvider,
    registerCodeActionProvider,
    registerDocumentFormattingEditProvider,
    registerDocumentRangeFormattingEditProvider,
    registerOnTypeFormattingEditProvider,
    registerLinkProvider,
    registerColorProvider,
    registerFoldingRangeProvider,
    registerDeclarationProvider,
    registerSelectionRangeProvider,
    registerCompletionItemProvider,
    // enums
    // TODO: const enum
    // Classes
    FoldingRangeKind,
  });
}

export const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
