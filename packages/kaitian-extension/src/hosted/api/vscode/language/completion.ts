import URI from 'vscode-uri/lib/umd';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import type * as vscode from 'vscode';
import { CompletionContext, Position, CompletionItemInsertTextRule, CompletionItem } from '../../../../common/vscode/model.api';
import { SnippetString } from '../../../../common/vscode/ext-types';
import { mixin } from '../../../../common/vscode/utils';
import { CommandsConverter } from '../ext.host.command';
import { DisposableStore } from '@ali/ide-core-common';

export class CompletionAdapter {
    private cacheId = 0;
    private cache = new Map<number, {[key: number]: vscode.CompletionItem }>();
    private toDispose = new Map<number, DisposableStore>();

    constructor(private readonly delegate: vscode.CompletionItemProvider,
                private readonly commandConverter: CommandsConverter,
                private readonly documents: ExtensionDocumentDataManager) {

    }

    async provideCompletionItems(resource: URI, position: Position, context: CompletionContext, token: vscode.CancellationToken) {
        const document = this.documents.getDocumentData(resource);
        if (!document) {
            return Promise.reject(new Error(`There are no document for  ${resource}`));
        }

        const doc = document.document;
        const pos = Converter.toPosition(position);
        const result = await this.delegate.provideCompletionItems(doc, pos, token, context);
        if (!result) {
            return { isIncomplete: false, items: [] };
        }

        const disposables = new DisposableStore();
        const _id = this.cacheId ++;
        this.toDispose.set(_id, disposables);
        let itemId = 0;
        const isIncomplete = Array.isArray(result) ? false : result.isIncomplete;
        const originalItems = (Array.isArray(result) ? result : result.items);
        const r = {
            get $mid() { return -1; },
            get $type() { return 'CompletionList'; },
            _id,
            isIncomplete,
            items: originalItems.map((item) => {
                const id = itemId++;
                const resolved = this.convertCompletionItem(item, pos, id, _id);
                if (!resolved) {
                  return undefined;
                }
                return {
                    pid: _id,
                    id,
                    ...resolved,
                };
            }).filter((item) => !!item),
        };
        this.cache.set(_id, {});
        r.items.forEach((item, i) => {
            this.cache.get(_id)![item!.id] = originalItems[i]; // 这里必须设置原来提供的CompletionItem，因为vscode很多插件存在instanceOf判断
        });
        return r;
    }

    resolveCompletionItem(resource: URI, position: Position, completion: CompletionItem, token: vscode.CancellationToken): Promise<CompletionItem> {
        if (typeof this.delegate.resolveCompletionItem !== 'function') {
            return Promise.resolve(completion);
        }

        const { pid: parentId, id } = completion;
        const item = this.cache.has(parentId) && this.cache.get(parentId)![id];
        if (!item) {
            return Promise.resolve(completion);
        }

        return Promise.resolve(this.delegate.resolveCompletionItem(item, token)).then((resolvedItem) => {

            if (!resolvedItem) {
                return completion;
            }

            const pos = Converter.toPosition(position);
            const newCompletion = this.convertCompletionItem(resolvedItem, pos, id, parentId);
            if (newCompletion) {
                mixin(completion, newCompletion, true);
            }

            return completion;
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

    private convertCompletionItem(item: vscode.CompletionItem, position: vscode.Position, id: number, parentId: number): CompletionItem | undefined {
        if (typeof item.label !== 'string' || item.label.length === 0) {
            // tslint:disable no-console
            console.warn('Invalid Completion Item -> must have at least a label');
            return undefined;
        }
        const disposables = this.toDispose.get(parentId);
        if (!disposables) {
          throw Error('DisposableStore is missing...');
        }

        const result: CompletionItem = {
            id,
            // FIXME range为空
            range: Converter.fromRange(item.range!),
            kind: Converter.fromCompletionItemKind(item.kind),
            parentId,
            label: item.label,
            detail: item.detail,
            documentation: item.documentation,
            filterText: item.filterText,
            sortText: item.sortText,
            preselect: item.preselect,
            insertText: '',
            additionalTextEdits: item.additionalTextEdits && item.additionalTextEdits.map(Converter.fromTextEdit),
            command: item.command ? this.commandConverter.toInternal(item.command, disposables) : undefined,
            commitCharacters: item.commitCharacters,
            insertTextRules: undefined,
        };

        if (item.textEdit) {
          result.insertText = item.textEdit.newText;
        } else if (typeof item.insertText === 'string') {
            result.insertText = item.insertText;
            result.snippetType = 'internal';
        } else if (item.insertText instanceof SnippetString) {
            result.insertText = item.insertText.value;
            result.snippetType = 'textmate';
            result.insertTextRules = CompletionItemInsertTextRule.InsertAsSnippet;
        } else {
          result.insertText = item.label;
          result.snippetType = 'internal';
        }

        let range: vscode.Range | undefined;
        if (item.textEdit) {
          range = item.textEdit.range;
        } else if (item.range) {
          range = item.range;
        }
        if (range) {
          result.overwriteBefore = position.character - range.start.character;
          result.overwriteAfter = range.end.character - position.character;

          if (!range.isSingleLine || range.start.line !== position.line) {
              // tslint:disable no-console
              console.warn('Invalid Completion Item -> must be single line and on the same line');
              return undefined;
          }
        }

        return result;
    }

    static hasResolveSupport(provider: vscode.CompletionItemProvider): boolean {
        return typeof provider.resolveCompletionItem === 'function';
    }
}
