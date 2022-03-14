import type vscode from 'vscode';

import { Uri, CancellationToken } from '@opensumi/ide-core-common';
import { IdGenerator } from '@opensumi/ide-core-common/lib/id-generator';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import {
  Position,
  IIncomingCallDto,
  IOutgoingCallDto,
  ICallHierarchyItemDto,
} from '../../../../common/vscode/model.api';

export class CallHierarchyAdapter {
  private readonly _idPool = new IdGenerator('');
  private readonly _cache = new Map<string, Map<string, vscode.CallHierarchyItem>>();

  constructor(
    private readonly documents: ExtensionDocumentDataManager,
    private readonly provider: vscode.CallHierarchyProvider,
  ) {}

  async prepareSession(
    uri: Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<ICallHierarchyItemDto[] | undefined> {
    const documentData = this.documents.getDocumentData(uri);
    if (!documentData) {
      return Promise.reject(new Error(`There is no document for ${uri}`));
    }

    const doc = documentData.document;
    const pos = Converter.toPosition(position);

    const items = await this.provider.prepareCallHierarchy(doc, pos, token);
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

  async provideCallsTo(
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<IIncomingCallDto[] | undefined> {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error('missing call hierarchy item');
    }
    const calls = await this.provider.provideCallHierarchyIncomingCalls(item, token);
    if (!calls) {
      return undefined;
    }
    return calls.map((call) => ({
      from: this._cacheAndConvertItem(sessionId, call.from),
      fromRanges: call.fromRanges.map((r) => Converter.fromRange(r)),
    }));
  }

  async provideCallsFrom(
    sessionId: string,
    itemId: string,
    token: CancellationToken,
  ): Promise<IOutgoingCallDto[] | undefined> {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error('missing call hierarchy item');
    }
    const calls = await this.provider.provideCallHierarchyOutgoingCalls(item, token);
    if (!calls) {
      return undefined;
    }
    return calls.map((call) => ({
      to: this._cacheAndConvertItem(sessionId, call.to),
      fromRanges: call.fromRanges.map((r) => Converter.fromRange(r)),
    }));
  }

  releaseSession(sessionId: string): void {
    this._cache.delete(sessionId);
  }

  private _cacheAndConvertItem(sessionId: string, item: vscode.CallHierarchyItem): ICallHierarchyItemDto {
    const map = this._cache.get(sessionId)!;
    const dto: ICallHierarchyItemDto = {
      _sessionId: sessionId,
      _itemId: map.size.toString(36),
      name: item.name,
      detail: item.detail,
      kind: Converter.SymbolKind.fromSymbolKind(item.kind),
      uri: item.uri,
      range: Converter.fromRange(item.range),
      selectionRange: Converter.fromRange(item.selectionRange),
      tags: item.tags?.map(Converter.SymbolTag.from),
    };
    map.set(dto._itemId, item);
    return dto;
  }

  private _itemFromCache(sessionId: string, itemId: string): vscode.CallHierarchyItem | undefined {
    const map = this._cache.get(sessionId);
    return map?.get(itemId);
  }
}
