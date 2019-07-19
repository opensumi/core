import * as vscode from 'vscode';
import { Emitter } from '@ali/ide-core-common';
import { createMainContextProxyIdentifier, createExtHostContextProxyIdentifier} from '@ali/ide-connection';
import { VSCodeExtensionService } from '../browser/types';
import { SerializedDocumentFilter, CompletionResultDto, Completion, Hover, Position, Definition, DefinitionLink, FoldingRange, RawColorInfo, ColorPresentation, DocumentHighlight } from './model.api';
import { IMainThreadDocumentsShape, ExtensionDocumentDataManager } from './doc';
import { Disposable, CompletionItem } from './ext-types';
import { IMainThreadCommands, IExtHostCommands } from './command';
import { IMainThreadMessage, IExtHostMessage } from './window';
import { DocumentSelector, CompletionItemProvider, CompletionContext, CancellationToken, CompletionList, DefinitionProvider, TypeDefinitionProvider, FoldingRangeProvider, FoldingContext, DocumentColorProvider } from 'vscode';
import { UriComponents } from 'vscode-uri';
import { IMainThreadWorkspace, IExtHostWorkspace } from './workspace';
import { ExtHostLanguages } from '../node/api/ext.host.language';
import { IFeatureExtension } from '@ali/ide-feature-extension/src/browser/types';
import { IMainThreadPreference, IExtHostPreference } from './preference';

export const MainThreadAPIIdentifier = {
  MainThreadCommands: createMainContextProxyIdentifier<IMainThreadCommands>('MainThreadCommands'),
  MainThreadStatusBar: createMainContextProxyIdentifier<IMainThreadStatusBar>('MainThreadStatusBar'),
  MainThreadLanguages: createMainContextProxyIdentifier<IMainThreadLanguages>('MainThreadLanguages'),
  MainThreadExtensionServie: createMainContextProxyIdentifier<VSCodeExtensionService>('MainThreadExtensionServie'),
  MainThreadDocuments: createExtHostContextProxyIdentifier<IMainThreadDocumentsShape>('MainThreadDocuments'),
  MainThreadMessages: createExtHostContextProxyIdentifier<IMainThreadMessage>('MainThreadMessage'),
  MainThreadWorkspace: createExtHostContextProxyIdentifier<IMainThreadWorkspace>('MainThreadWorkspace'),
  MainThreadPreference: createExtHostContextProxyIdentifier<IMainThreadPreference>('MainThreadPreference'),
};

export const ExtHostAPIIdentifier = {
  // 使用impl作为类型
  ExtHostLanguages: createExtHostContextProxyIdentifier<ExtHostLanguages>('ExtHostLanguages'),
  ExtHostStatusBar: createExtHostContextProxyIdentifier<IExtHostStatusBar>('ExtHostStatusBar'),
  ExtHostCommands: createExtHostContextProxyIdentifier<IExtHostCommands>('ExtHostCommandsRegistry'),
  ExtHostExtensionService: createExtHostContextProxyIdentifier<IExtensionProcessService>('ExtHostExtensionService'),
  ExtHostDocuments: createExtHostContextProxyIdentifier<ExtensionDocumentDataManager>('ExtHostDocuments'),
  ExtHostMessage: createExtHostContextProxyIdentifier<IExtHostMessage>('ExtHostMessage'),
  ExtHostWorkspace: createExtHostContextProxyIdentifier<IExtHostWorkspace>('ExtHostWorkspace'),
  ExtHostPreference: createExtHostContextProxyIdentifier<IExtHostPreference>('ExtHostPreference'),
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
export * from './preference';
