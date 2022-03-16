import type vscode from 'vscode';

import { Uri as URI, Cache } from '@opensumi/ide-core-common';
import { DisposableStore } from '@opensumi/ide-core-common';

import {
  ExtensionDocumentDataManager,
  ISuggestDataDto,
  ISuggestDataDtoField,
  ISuggestResultDto,
  ISuggestResultDtoField,
  RangeSuggestDataDto,
} from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import { SnippetString, Range, CompletionList, CompletionItemLabel } from '../../../../common/vscode/ext-types';
import {
  CompletionContext,
  Position,
  CompletionItemInsertTextRule,
  Range as ModelRange,
  ChainedCacheId,
} from '../../../../common/vscode/model.api';
import { CommandsConverter } from '../ext.host.command';

import { getPerformance } from './util';

export class CompletionAdapter {
  private cache = new Cache<{
    item: vscode.CompletionItem;
    resource: URI;
    position: Position;
  }>('CompletionItem');
  private toDispose = new Map<number, DisposableStore>();

  static supportsResolving(provider: vscode.CompletionItemProvider): boolean {
    return typeof provider.resolveCompletionItem === 'function';
  }

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
    const { doc, pos, replacing, inserting } = await this.getInsertOrReplace(resource, position);

    const perf = getPerformance();
    const startTime = perf ? perf.now() : 0;
    const itemOrList = await this.delegate.provideCompletionItems(doc, pos, token, context);
    const duration = perf ? Math.round(perf.now() - startTime) : 0;
    if (!itemOrList) {
      return undefined;
    }

    const isIncomplete = Array.isArray(itemOrList) ? false : itemOrList.isIncomplete;
    const list = Array.isArray(itemOrList) ? new CompletionList(itemOrList) : itemOrList;
    const pid = CompletionAdapter.supportsResolving(this.delegate)
      ? this.cache.add(list.items.map((e: vscode.CompletionItem) => ({ item: e, resource, position })))
      : this.cache.add([]);

    const disposables = new DisposableStore();
    this.toDispose.set(pid, disposables);

    const completions: ISuggestDataDto[] = [];
    const result: ISuggestResultDto = {
      x: pid,
      [ISuggestResultDtoField.completions]: completions,
      [ISuggestResultDtoField.defaultRanges]: {
        replace: Converter.Range.from(replacing)!,
        insert: Converter.Range.from(inserting)!,
      },
      [ISuggestResultDtoField.isIncomplete]: isIncomplete || undefined,
      [ISuggestResultDtoField.duration]: duration,
    };

    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i];
      // check for bad completion item first
      const dto = {
        [ISuggestDataDtoField.label]:
          typeof item.label === 'string' ? item.label : this.convertCompletionLabel(item.label),
        [ISuggestDataDtoField.kind]: item.kind ? Converter.CompletionItemKind.from(item.kind) : undefined,
        [ISuggestDataDtoField.sortText]: item.sortText,
        [ISuggestDataDtoField.filterText]: item.filterText,
        x: [pid, i] as [number, number],
      };

      // 如果不支持 resolveCompletionItem 则全量返回
      if (typeof this.delegate.resolveCompletionItem !== 'function') {
        if (item.textEdit) {
          dto[ISuggestDataDtoField.insertText] = item.textEdit.newText;
        } else if (typeof item.insertText === 'string') {
          dto[ISuggestDataDtoField.insertText] = item.insertText;
        } else if (item.insertText instanceof SnippetString) {
          dto[ISuggestDataDtoField.insertText] = item.insertText.value;
          dto[ISuggestDataDtoField.insertTextRules] = CompletionItemInsertTextRule.InsertAsSnippet;
        } else {
          dto[ISuggestDataDtoField.insertText] = typeof item.label === 'string' ? item.label : item.label.label;
        }
        dto[ISuggestDataDtoField.documentation] = item.documentation;
      }

      const range = this.convertRange(item, inserting, replacing);
      if (range) {
        dto[ISuggestDataDtoField.range] = range;
      }

      completions.push(dto);
    }
    return result;
  }

  async resolveCompletionItem(
    id: ChainedCacheId,
    token: vscode.CancellationToken,
  ): Promise<ISuggestDataDto | undefined> {
    const _cache = this.cache.get(...id);
    if (!_cache) {
      return undefined;
    }

    const { item, resource, position } = _cache;

    let inserting;
    let replacing;

    if (resource && position) {
      const _ = await this.getInsertOrReplace(resource, position);
      inserting = _.inserting;
      replacing = _.replacing;
    }

    const convertItem = this.convertCompletionItem(item, id, inserting, replacing);

    if (typeof this.delegate.resolveCompletionItem !== 'function') {
      return convertItem;
    }

    try {
      const resolvedItem = await this.delegate.resolveCompletionItem(item, token);

      if (!resolvedItem) {
        return convertItem;
      }

      return this.convertCompletionItem(resolvedItem, id);
    } catch (error) {
      new Error(`Delegate.resolveCompletionItem error: ${error}`);
    }

    return convertItem;
  }

  async releaseCompletionItems(id: number) {
    this.cache.delete(id);
    const toDispose = this.toDispose.get(id);
    if (toDispose) {
      toDispose.dispose();
      this.toDispose.delete(id);
    }
    return Promise.resolve();
  }

  private async getInsertOrReplace(resource: URI, position: Position) {
    const document = this.documents.getDocumentData(resource);
    if (!document) {
      return Promise.reject(new Error(`There are no document for  ${resource}`));
    }

    const doc = document.document;
    const pos = Converter.toPosition(position);
    const replacing = doc.getWordRangeAtPosition(pos) || new Range(pos, pos);
    const inserting = replacing.with({ end: pos });
    return { inserting, replacing, doc, pos };
  }

  private convertRange(
    item: vscode.CompletionItem,
    defaultInserting?: vscode.Range,
    defaultReplacing?: vscode.Range,
  ): RangeSuggestDataDto.ISuggestRangeDto | { insert: ModelRange; replace: ModelRange } | undefined {
    let range: vscode.Range | { inserting: vscode.Range; replacing: vscode.Range } | undefined;
    if (item.textEdit) {
      range = item.textEdit.range;
    } else if (item.range) {
      range = item.range;
    }

    let toRange;

    if (Range.isRange(range)) {
      toRange = RangeSuggestDataDto.to(Converter.Range.from(range));
    } else if (range && (!defaultInserting?.isEqual(range.inserting) || !defaultReplacing?.isEqual(range.replacing))) {
      toRange = {
        insert: Converter.Range.from(range.inserting),
        replace: Converter.Range.from(range.replacing),
      };
    }

    return toRange;
  }

  private convertCompletionLabel(label: CompletionItemLabel): string {
    let labelStr = label.label;
    if (label.description) {
      labelStr += `~|${label.description}`;
    }
    if (label.detail) {
      labelStr += `~|${label.detail}`;
    }
    return labelStr;
  }

  private convertCompletionItem(
    item: vscode.CompletionItem,
    id: ChainedCacheId,
    defaultInserting?: vscode.Range,
    defaultReplacing?: vscode.Range,
  ): ISuggestDataDto {
    const disposables = this.toDispose.get(id[0]);
    if (!disposables) {
      throw Error('DisposableStore is missing...');
    }

    const result: ISuggestDataDto = {
      x: id,
      [ISuggestDataDtoField.kind]: item.kind ? Converter.CompletionItemKind.from(item.kind) : undefined,
      [ISuggestDataDtoField.kindModifier]: item.tags && item.tags.map(Converter.CompletionItemTag.from),
      [ISuggestDataDtoField.label]:
        typeof item.label === 'string' ? item.label : this.convertCompletionLabel(item.label),
      [ISuggestDataDtoField.detail]: item.detail,
      [ISuggestDataDtoField.documentation]: item.documentation,
      [ISuggestDataDtoField.filterText]: item.filterText,
      [ISuggestDataDtoField.sortText]: item.sortText,
      [ISuggestDataDtoField.preselect]: item.preselect ? item.preselect : undefined,
      [ISuggestDataDtoField.insertText]: '',
      [ISuggestDataDtoField.additionalTextEdits]:
        item.additionalTextEdits && item.additionalTextEdits.map(Converter.fromTextEdit),
      [ISuggestDataDtoField.command]: this.commandConverter.toInternal(item.command, disposables),
      [ISuggestDataDtoField.commitCharacters]: item.commitCharacters,
      [ISuggestDataDtoField.insertTextRules]: item.keepWhitespace ? CompletionItemInsertTextRule.KeepWhitespace : 0,
    };

    const convertRange = this.convertRange(item, defaultInserting, defaultReplacing);

    if (convertRange) {
      result[ISuggestDataDtoField.range] = convertRange;
    }

    if (item.textEdit) {
      result[ISuggestDataDtoField.insertText] = item.textEdit.newText;
    } else if (typeof item.insertText === 'string') {
      result[ISuggestDataDtoField.insertText] = item.insertText;
    } else if (item.insertText instanceof SnippetString) {
      result[ISuggestDataDtoField.insertText] = item.insertText.value;
      result[ISuggestDataDtoField.insertTextRules] = CompletionItemInsertTextRule.InsertAsSnippet;
    } else {
      result[ISuggestDataDtoField.insertText] = typeof item.label === 'string' ? item.label : item.label.label;
    }
    return result;
  }

  static hasResolveSupport(provider: vscode.CompletionItemProvider): boolean {
    return typeof provider.resolveCompletionItem === 'function';
  }
}
