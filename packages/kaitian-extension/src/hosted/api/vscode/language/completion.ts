import { Uri as URI } from '@ali/ide-core-common';
import { ExtensionDocumentDataManager, ISuggestDataDto, ISuggestDataDtoField } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import type * as vscode from 'vscode';
import {
  CompletionContext,
  Position,
  CompletionItemInsertTextRule,
  CompletionItem,
} from '../../../../common/vscode/model.api';
import { SnippetString, Range } from '../../../../common/vscode/ext-types';
import { CommandsConverter } from '../ext.host.command';
import { DisposableStore } from '@ali/ide-core-common';
import { getPerformance } from './util';

export class CompletionAdapter {
  private cacheId = 0;
  private cache = new Map<number, { [key: number]: vscode.CompletionItem }>();
  private toDispose = new Map<number, DisposableStore>();

  constructor(
    private readonly delegate: vscode.CompletionItemProvider,
    private readonly commandConverter: CommandsConverter,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  async provideCompletionItems(
    resource: URI,
    position: Position,
    context: CompletionContext,
    token: vscode.CancellationToken,
  ) {
    const document = this.documents.getDocumentData(resource);
    if (!document) {
      return Promise.reject(
        new Error(`There are no document for  ${resource}`),
      );
    }

    const doc = document.document;
    const pos = Converter.toPosition(position);
    const replacing = doc.getWordRangeAtPosition(pos) || new Range(pos, pos);
    const inserting = replacing.with({ end: pos });
    const perf = getPerformance();
    const startTime = perf ? perf.now() : 0;
    const result = await this.delegate.provideCompletionItems(
      doc,
      pos,
      token,
      context,
    );
    const duration = perf ? Math.round(perf.now() - startTime) : 0;
    if (!result) {
      return { isIncomplete: false, items: [] };
    }

    const disposables = new DisposableStore();
    const _id = this.cacheId++;
    this.toDispose.set(_id, disposables);
    let itemId = 0;
    const isIncomplete = Array.isArray(result) ? false : result.isIncomplete;
    const originalItems = Array.isArray(result) ? result : result.items;
    const r = {
      get $mid() {
        return -1;
      },
      _id,
      _dur: duration,
      isIncomplete,
      defaultRange: {
        replace: Converter.fromRange(replacing),
        insert: Converter.fromRange(inserting),
      },
      items: originalItems
        .map((item) => {
          const id = itemId++;
          const resolved = this.convertCompletionItem(
            item,
            id,
            _id,
            inserting,
            replacing,
          );
          if (!resolved) {
            return undefined;
          }
          return resolved;
        })
        .filter((item) => !!item),
    };
    this.cache.set(_id, {});
    r.items.forEach((item, i) => {
      // x: id, id 为 [id, parentId], 所以 item.x[0] 既是原本的 id
      this.cache.get(_id)![item?.x![0]!] = originalItems[i]; // 这里必须设置原来提供的CompletionItem，因为vscode很多插件存在instanceOf判断
    });
    return r;
  }

  resolveCompletionItem(
    resource: URI,
    position: Position,
    completion: CompletionItem,
    token: vscode.CancellationToken,
  ): Promise<ISuggestDataDto | undefined> {
    if (typeof this.delegate.resolveCompletionItem !== 'function') {
      return Promise.resolve(undefined);
    }

    const { pid: parentId, id } = completion;
    const item = this.cache.has(parentId) && this.cache.get(parentId)![id];
    if (!item) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve(
      this.delegate.resolveCompletionItem(item, token),
    ).then((resolvedItem) => {
      if (!resolvedItem) {
        return undefined;
      }

      const newCompletion = this.convertCompletionItem(
        resolvedItem,
        id,
        parentId,
      );
      return newCompletion;
    });
  }

  releaseCompletionItems(id: number) {
    this.cache.delete(id);
    const toDispose = this.toDispose.get(id);
    if (toDispose) {
      toDispose.dispose();
      this.toDispose.delete(id);
    }
    return Promise.resolve();
  }

  private convertCompletionItem(
    item: vscode.CompletionItem,
    id: number,
    parentId: number,
    defaultInserting?: vscode.Range,
    defaultReplacing?: vscode.Range,
  ): ISuggestDataDto | undefined {
    if (typeof item.label !== 'string' || item.label.length === 0) {
      // tslint:disable no-console
      console.warn('Invalid Completion Item -> must have at least a label');
      return undefined;
    }
    const disposables = this.toDispose.get(parentId);
    if (!disposables) {
      throw Error('DisposableStore is missing...');
    }

    let range: CompletionItem['range'] | undefined;
    const itemRange = item.textEdit?.range || item.range;
    if (Range.isRange(itemRange)) {
      range = Converter.fromRange(itemRange);
    } else if (
      itemRange &&
      (!defaultInserting?.isEqual(itemRange.inserting) ||
        !defaultReplacing?.isEqual(itemRange.replacing))
    ) {
      range = {
        insert: Converter.fromRange(itemRange.inserting),
        replace: Converter.fromRange(itemRange.replacing),
      };
    }

    const result: ISuggestDataDto = {
      x: [id, parentId],
      [ISuggestDataDtoField.range]: range,
      [ISuggestDataDtoField.kind]: item.kind ? Converter.fromCompletionItemKind(item.kind) : undefined,
      [ISuggestDataDtoField.kindModifier]: item.tags && item.tags.map(Converter.CompletionItemTag.from),
      [ISuggestDataDtoField.label]: item.label,
      [ISuggestDataDtoField.detail]: item.detail,
      [ISuggestDataDtoField.documentation]: item.documentation,
      [ISuggestDataDtoField.filterText]: item.filterText,
      [ISuggestDataDtoField.sortText]: item.sortText,
      [ISuggestDataDtoField.preselect]: item.preselect ? item.preselect : undefined,
      [ISuggestDataDtoField.insertText]: '',
      [ISuggestDataDtoField.additionalTextEdits]:
        item.additionalTextEdits &&
        item.additionalTextEdits.map(Converter.fromTextEdit),
        [ISuggestDataDtoField.command]: item.command
        ? this.commandConverter.toInternal(item.command, disposables)
        : undefined,
        [ISuggestDataDtoField.commitCharacters]: item.commitCharacters,
        [ISuggestDataDtoField.insertTextRules]: undefined,
    };

    if (item.textEdit) {
      result[ISuggestDataDtoField.insertText] = item.textEdit.newText;
    } else if (typeof item.insertText === 'string') {
      result[ISuggestDataDtoField.insertText] = item.insertText;
    } else if (item.insertText instanceof SnippetString) {
      result[ISuggestDataDtoField.insertText] = item.insertText.value;
      result[ISuggestDataDtoField.insertTextRules] = CompletionItemInsertTextRule.InsertAsSnippet;
    } else {
      result[ISuggestDataDtoField.insertText] = item.label;
    }
    return result;
  }

  static hasResolveSupport(provider: vscode.CompletionItemProvider): boolean {
    return typeof provider.resolveCompletionItem === 'function';
  }
}
