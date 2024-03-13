import { LanguageFeatureRegistry } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languageFeatureRegistry';

import type { CancellationToken, IPosition, IRange, SymbolTag, Uri as URI } from '@opensumi/ide-core-common';
import type { Position } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/position';
import type { ProviderResult, SymbolKind } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import type { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

export const enum TypeHierarchyDirection {
  Subtypes = 'subtypes',
  Supertypes = 'supertypes',
}

export interface TypeHierarchyItem {
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

export interface TypeHierarchySession {
  roots: TypeHierarchyItem[];
  dispose(): void;
}

export interface TypeHierarchyProvider {
  prepareTypeHierarchy(
    document: ITextModel,
    position: IPosition,
    token: CancellationToken,
  ): ProviderResult<TypeHierarchySession>;
  provideSupertypes(item: TypeHierarchyItem, token: CancellationToken): ProviderResult<TypeHierarchyItem[]>;
  provideSubtypes(item: TypeHierarchyItem, token: CancellationToken): ProviderResult<TypeHierarchyItem[]>;
}

export interface ITypeHierarchyService {
  registerTypeHierarchyProvider: (selector: any, provider: TypeHierarchyProvider) => void;

  prepareTypeHierarchyProvider: (resource: URI, position: Position) => Promise<TypeHierarchyItem[]>;

  provideSupertypes: (item: TypeHierarchyItem) => ProviderResult<TypeHierarchyItem[]>;

  provideSubtypes: (item: TypeHierarchyItem) => ProviderResult<TypeHierarchyItem[]>;
}

export const ITypeHierarchyService = Symbol('ITypeHierarchyService');

export const TypeHierarchyProviderRegistry = new LanguageFeatureRegistry<TypeHierarchyProvider>();
