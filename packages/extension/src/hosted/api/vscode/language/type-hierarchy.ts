import type vscode from 'vscode';

import { Uri, CancellationToken } from '@opensumi/ide-core-common';
import { IdGenerator } from '@opensumi/ide-core-common/lib/id-generator';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import { Position, ITypeHierarchyItemDto } from '../../../../common/vscode/model.api';

export class TypeHierarchyAdapter {
  private readonly _idPool = new IdGenerator('');
  private readonly _cache = new Map<string, Map<string, vscode.TypeHierarchyItem>>();

  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.TypeHierarchyProvider,
  ) {}

  async prepareSession(
    uri: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<ITypeHierarchyItemDto[] | undefined> {
    const documentData = this._documents.getDocumentData(uri);

    if (!documentData) {
      return Promise.reject(new Error(`There is no document for ${uri}`));
    }

    const doc = documentData.document;
    const pos = Converter.Position.to(position);

    const items = await this._provider.prepareTypeHierarchy(doc, pos, token);
    if (!items) {
      return undefined;
    }

    const sessionId = this._idPool.nextId();
    this._cache.set(sessionId, new Map());

    if (Array.isArray(items)) {
      return items.map((item) => this._cacheAndConvertItem(sessionId, item));
    } else {
      return [this._cacheAndConvertItem(sessionId, items)];
    }
  }

  async provideSupertypes(
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<ITypeHierarchyItemDto[] | undefined> {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error('missing type hierarchy item');
    }
    const supertypes = await this._provider.provideTypeHierarchySupertypes(item, token);
    if (!supertypes) {
      return undefined;
    }
    return supertypes.map((supertype) => this._cacheAndConvertItem(sessionId, supertype));
  }

  async provideSubtypes(
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<ITypeHierarchyItemDto[] | undefined> {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error('missing type hierarchy item');
    }
    const subtypes = await this._provider.provideTypeHierarchySubtypes(item, token);
    if (!subtypes) {
      return undefined;
    }
    return subtypes.map((subtype) => this._cacheAndConvertItem(sessionId, subtype));
  }

  releaseSession(sessionId: string): void {
    this._cache.delete(sessionId);
  }

  private _cacheAndConvertItem(sessionId: string, item: vscode.TypeHierarchyItem): ITypeHierarchyItemDto {
    const map = this._cache.get(sessionId)!;
    const dto = Converter.TypeHierarchyItem.from(item, sessionId, map.size.toString(36));
    map.set(dto._itemId, item);
    return dto;
  }

  private _itemFromCache(sessionId: string, itemId: string): vscode.TypeHierarchyItem | undefined {
    const map = this._cache.get(sessionId);
    return map?.get(itemId);
  }
}
