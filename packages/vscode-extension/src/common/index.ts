import * as vscode from 'vscode';
import { Emitter } from '@ali/ide-core-common';
import { createMainContextProxyIdentifier, createExtHostContextProxyIdentifier} from '@ali/ide-connection';
import { VSCodeExtensionService } from '../browser/types';
import { SerializedDocumentFilter, CompletionResultDto, Completion, Hover, Position, Range, Definition, DefinitionLink, FoldingRange, RawColorInfo, ColorPresentation, DocumentHighlight, FormattingOptions, SingleEditOperation, CodeLensSymbol, DocumentLink, SerializedLanguageConfiguration, ReferenceContext, Location, ILink } from './model.api';
import { IMainThreadDocumentsShape, ExtensionDocumentDataManager } from './doc';
import { Disposable, CompletionItem } from './ext-types';
import { IMainThreadCommands, IExtHostCommands } from './command';
import { DocumentSelector, CompletionItemProvider, CompletionContext, CancellationToken, CompletionList, DefinitionProvider, TypeDefinitionProvider, FoldingRangeProvider, FoldingContext, DocumentColorProvider, DocumentRangeFormattingEditProvider, OnTypeFormattingEditProvider } from 'vscode';
import { UriComponents } from 'vscode-uri';
import { IMainThreadMessage, IExtHostMessage, IExtHostQuickOpen, IMainThreadQuickOpen } from './window';
import { IMainThreadWorkspace, IExtHostWorkspace } from './workspace';
import { IMainThreadEditorsService, IExtensionHostEditorService } from './editor';
import { ExtHostLanguages } from '../node/api/ext.host.language';
import { IFeatureExtension } from '@ali/ide-feature-extension/src/browser/types';
import { IMainThreadPreference, IExtHostPreference } from './preference';
import { IMainThreadEnv, IExtHostEnv } from './env';
import { IExtHostFileSystem, IMainThreadFileSystem } from './file-system';

export const MainThreadAPIIdentifier = {
  MainThreadCommands: createMainContextProxyIdentifier<IMainThreadCommands>('MainThreadCommands'),
  MainThreadStatusBar: createMainContextProxyIdentifier<IMainThreadStatusBar>('MainThreadStatusBar'),
  MainThreadLanguages: createMainContextProxyIdentifier<IMainThreadLanguages>('MainThreadLanguages'),
  MainThreadExtensionServie: createMainContextProxyIdentifier<VSCodeExtensionService>('MainThreadExtensionServie'),
  MainThreadDocuments: createExtHostContextProxyIdentifier<IMainThreadDocumentsShape>('MainThreadDocuments'),
  MainThreadEditors: createExtHostContextProxyIdentifier<IMainThreadEditorsService>('MainThreadEditors'),
  MainThreadMessages: createExtHostContextProxyIdentifier<IMainThreadMessage>('MainThreadMessage'),
  MainThreadWorkspace: createExtHostContextProxyIdentifier<IMainThreadWorkspace>('MainThreadWorkspace'),
  MainThreadPreference: createExtHostContextProxyIdentifier<IMainThreadPreference>('MainThreadPreference'),
  MainThreadEnv: createExtHostContextProxyIdentifier<IMainThreadEnv>('MainThreadEnv'),
  MainThreadQuickOpen: createExtHostContextProxyIdentifier<IMainThreadQuickOpen>('MainThreadQuickPick'),
  MainThreadFileSystem: createExtHostContextProxyIdentifier<IMainThreadFileSystem>('MainThreadFileSystem'),
};

export const ExtHostAPIIdentifier = {
  // 使用impl作为类型
  ExtHostLanguages: createExtHostContextProxyIdentifier<ExtHostLanguages>('ExtHostLanguages'),
  ExtHostStatusBar: createExtHostContextProxyIdentifier<IExtHostStatusBar>('ExtHostStatusBar'),
  ExtHostCommands: createExtHostContextProxyIdentifier<IExtHostCommands>('ExtHostCommandsRegistry'),
  ExtHostExtensionService: createExtHostContextProxyIdentifier<IExtensionProcessService>('ExtHostExtensionService'),
  ExtHostDocuments: createExtHostContextProxyIdentifier<ExtensionDocumentDataManager>('ExtHostDocuments'),
  ExtHostEditors: createExtHostContextProxyIdentifier<IExtensionHostEditorService>('ExtHostEditors'),
  ExtHostMessage: createExtHostContextProxyIdentifier<IExtHostMessage>('ExtHostMessage'),
  ExtHostWorkspace: createExtHostContextProxyIdentifier<IExtHostWorkspace>('ExtHostWorkspace'),
  ExtHostPreference: createExtHostContextProxyIdentifier<IExtHostPreference>('ExtHostPreference'),
  ExtHostEnv: createExtHostContextProxyIdentifier<IExtHostEnv>('ExtHostEnv'),
  ExtHostQuickOpen: createExtHostContextProxyIdentifier<IExtHostQuickOpen>('ExtHostQuickOpen'),
  ExtHostFileSystem: createExtHostContextProxyIdentifier<IExtHostFileSystem>('ExtHostFileSystem'),
};

export abstract class VSCodeExtensionNodeService {
  abstract async getExtHostPath(): Promise<string>;
}

export const VSCodeExtensionNodeServiceServerPath = 'VSCodeExtensionNodeServiceServerPath';

export interface IExtensionProcessService {
  $activateExtension(id: string): Promise<void>;
  activateExtension(id: string): Promise<void>;
  getExtensions(): IFeatureExtension[];
  $getExtensions(): IFeatureExtension[];
  getExtension(extensionId: string): vscode.Extension<any> | undefined;

  extensionsChangeEmitter: Emitter<string>;
}

export interface IMainThreadLanguages {
  $unregister(handle: number): void;
  $registerDocumentHighlightProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerHoverProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $getLanguages(): string[];
  $registerCompletionSupport(handle: number, selector: SerializedDocumentFilter[], triggerCharacters: string[], supportsResolveDetails: boolean): void;
  $registerDefinitionProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerTypeDefinitionProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerFoldingRangeProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerDocumentColorProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerRangeFormattingProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerOnTypeFormattingProvider(handle: number, selector: SerializedDocumentFilter[], triggerCharacter: string[]): void;
  $registerCodeLensSupport(handle: number, selector: SerializedDocumentFilter[], eventHandle?: number): void;
  $emitCodeLensEvent(eventHandle: number, event?: any): void;
  $setLanguageConfiguration(handle: number, languageId: string, configuration: SerializedLanguageConfiguration): void;
  $registerReferenceProvider(handle: number, selector: SerializedDocumentFilter[]): void;
  $registerDocumentLinkProvider(handle: number, selector: SerializedDocumentFilter[]): void;
}

export interface IExtHostLanguages {
  getLanguages(): Promise<string[]>;

  registerHoverProvider(selector, provider): Disposable;
  $provideHover(handle: number, resource: any, position: any, token: any): Promise<Hover | undefined>;

  registerCompletionItemProvider(selector: DocumentSelector, provider: CompletionItemProvider, triggerCharacters: string[]): Disposable;
  $provideCompletionItems(handle: number, resource: UriComponents, position: Position,
                          context: CompletionContext, token: CancellationToken);
  $resolveCompletionItem(handle: number, resource: UriComponents, position: Position, completion: Completion, token: CancellationToken): Promise<Completion>;
  $releaseCompletionItems(handle: number, id: number): void;

  $provideDefinition(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined>;
  registerDefinitionProvider(selector: DocumentSelector, provider: DefinitionProvider): Disposable;

  $provideTypeDefinition(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<Definition | DefinitionLink[] | undefined>;
  registerTypeDefinitionProvider(selector: DocumentSelector, provider: TypeDefinitionProvider): Disposable;

  registerFoldingRangeProvider(selector: DocumentSelector, provider: FoldingRangeProvider): Disposable;
  $provideFoldingRange(handle: number, resource: UriComponents, context: FoldingContext, token: CancellationToken): Promise<FoldingRange[] | undefined>;

  registerColorProvider(selector: DocumentSelector, provider: DocumentColorProvider): Disposable;
  $provideDocumentColors(handle: number, resource: UriComponents, token: CancellationToken): Promise<RawColorInfo[]>;
  $provideColorPresentations(handle: number, resource: UriComponents, colorInfo: RawColorInfo, token: CancellationToken): PromiseLike<ColorPresentation[]>;

  $provideDocumentHighlights(handle: number, resource: UriComponents, position: Position, token: CancellationToken): Promise<DocumentHighlight[] | undefined>;

  registerDocumentRangeFormattingEditProvider(selector: DocumentSelector, provider: DocumentRangeFormattingEditProvider): Disposable;
  $provideDocumentRangeFormattingEdits(handle: number, resource: UriComponents, range: Range, options: FormattingOptions): Promise<SingleEditOperation[] | undefined>;

  registerOnTypeFormattingEditProvider(selector: DocumentSelector, provider: OnTypeFormattingEditProvider, firstTriggerCharacter: string, ...moreTriggerCharacter: string[]): Disposable;
  $provideOnTypeFormattingEdits(handle: number, resource: UriComponents, position: Position, ch: string, options: FormattingOptions): Promise<SingleEditOperation[] | undefined>;

  $provideCodeLenses(handle: number, resource: UriComponents): Promise<CodeLensSymbol[] | undefined>;
  $resolveCodeLens(handle: number, resource: UriComponents, symbol: CodeLensSymbol): Promise<CodeLensSymbol | undefined>;

  $provideDocumentLinks(handle: number, resource: UriComponents, token: CancellationToken): Promise<ILink[] | undefined>;
  $resolveDocumentLink(handle: number, link: ILink, token: CancellationToken): Promise<ILink | undefined>;

  $provideReferences(handle: number, resource: UriComponents, position: Position, context: ReferenceContext, token: CancellationToken): Promise<Location[] | undefined>;
}

export interface IMainThreadStatusBar {
  $setStatusBarMessage(text: string): void;

  $dispose(): void;
}

export interface IExtHostStatusBar {

  setStatusBarMessage(text: string, arg?: number | Thenable<any>): Disposable;

}

export * from './doc';
export * from './command';
export * from './window';
export * from './workspace';
export * from './editor';
export * from './preference';
export * from './strings';
export * from './env';
export * from './file-system';
