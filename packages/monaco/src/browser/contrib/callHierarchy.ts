import type { Uri as URI, IRange, SymbolTag, IPosition, CancellationToken } from '@opensumi/ide-core-common';
import type { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';
import type { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import type { ProviderResult, SymbolKind } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import { LanguageFeatureRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes/languageFeatureRegistry';

export interface CallHierarchyItem {
  _sessionId: string;
  _itemId: string;
  kind: SymbolKind;
  name: string;
  detail?: string;
  uri: URI;
  range: IRange;
  selectionRange: IRange;
  tags?: SymbolTag[];
}

export interface IncomingCall {
  from: CallHierarchyItem;
  fromRanges: IRange[];
}

export interface OutgoingCall {
  fromRanges: IRange[];
  to: CallHierarchyItem;
}

export interface CallHierarchySession {
  roots: CallHierarchyItem[];
  dispose(): void;
}

export interface CallHierarchyProvider {
  prepareCallHierarchy(
    document: ITextModel,
    position: IPosition,
    token: CancellationToken,
  ): ProviderResult<CallHierarchySession>;

  provideIncomingCalls(item: CallHierarchyItem, token: CancellationToken): ProviderResult<IncomingCall[]>;

  provideOutgoingCalls(item: CallHierarchyItem, token: CancellationToken): ProviderResult<OutgoingCall[]>;
}

export const CallHierarchyProviderRegistry = new LanguageFeatureRegistry<CallHierarchyProvider>();

export interface ICallHierarchyService {
  registerCallHierarchyProvider: (selector: any, provider: CallHierarchyProvider) => void;

  prepareCallHierarchyProvider: (resource: URI, position: Position) => Promise<CallHierarchyItem[]>;

  provideIncomingCalls: (item: CallHierarchyItem) => ProviderResult<IncomingCall[]>;

  provideOutgoingCalls: (item: CallHierarchyItem) => ProviderResult<OutgoingCall[]>;
}

export const ICallHierarchyService = Symbol('ICallHierarchyService');
