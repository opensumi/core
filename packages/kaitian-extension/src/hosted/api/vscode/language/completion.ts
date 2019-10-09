import URI from 'vscode-uri/lib/umd';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import * as vscode from 'vscode';
import { CompletionContext, Position, CompletionItemInsertTextRule, CompletionItem } from '../../../../common/vscode/model.api';
import { Range, SnippetString } from '../../../../common/vscode/ext-types';
import { mixin } from '../../../../common/vscode/utils';
import { CommandsConverter } from '../ext.host.command';
import { DisposableStore } from '@ali/ide-core-common';

export class CompletionAdapter {
    private cacheId = 0;
    private cache = new Map<number, {[key: number]: vscode.CompletionItem }>();

    constructor(private readonly delegate: vscode.CompletionItemProvider,
                private readonly documents: ExtensionDocumentDataManager) {

    }

    async provideCompletionItems(resource: URI, position: Position, context: CompletionContext, commandConverter: CommandsConverter, token: vscode.CancellationToken) {
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
        let itemId = 0;
        const r = {
            _id,
            isIncomplete: Array.isArray(result) ? false : result.isIncomplete,
            items: (Array.isArray(result) ? result : result.items).map((item) => {
                return {
                    pid: _id,
                    id: itemId ++,
                    ...item,
                    insertText: Converter.fromInsertText(item),
                    insertTextRules: (item.insertText instanceof SnippetString ) ? CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: item.range ? Converter.fromRange(item.range) : null,
                    command: item.command ? commandConverter.toInternal(item.command, disposables) : undefined,
                };
            }),
        };
        this.cache.set(_id, {});
        r.items.forEach((item) => {
            this.cache.get(_id)![item.id] = item as any;
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

            const doc = this.documents.getDocumentData(resource)!.document;
            const pos = Converter.toPosition(position);
            const wordRangeBeforePos = (doc.getWordRangeAtPosition(pos) as Range || new Range(pos, pos)).with({ end: pos });
            const newCompletion = this.convertCompletionItem(resolvedItem, pos, wordRangeBeforePos, id, parentId);
            if (newCompletion) {
                mixin(completion, newCompletion, true);
            }

            return completion;
        });
    }

    releaseCompletionItems(id: number) {
        this.cache.delete(id);
        return Promise.resolve();
    }

    private convertCompletionItem(item: vscode.CompletionItem, position: vscode.Position, defaultRange: vscode.Range, id: number, parentId: number): CompletionItem | undefined {
        if (typeof item.label !== 'string' || item.label.length === 0) {
            console.warn('Invalid Completion Item -> must have at least a label');
            return undefined;
        }

        const result: CompletionItem = {
            id,
            // TODO range undefined兼容
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
            command: undefined,   // TODO: implement this: this.commands.toInternal(item.command),
            commitCharacters: item.commitCharacters,
            insertTextRules: undefined,
        };

        if (typeof item.insertText === 'string') {
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

        let range: vscode.Range;
        if (item.range) {
            range = item.range;
        } else {
            range = defaultRange;
        }
        result.overwriteBefore = position.character - range.start.character;
        result.overwriteAfter = range.end.character - position.character;

        if (!range.isSingleLine || range.start.line !== position.line) {
            console.warn('Invalid Completion Item -> must be single line and on the same line');
            return undefined;
        }

        return result;
    }

    static hasResolveSupport(provider: vscode.CompletionItemProvider): boolean {
        return typeof provider.resolveCompletionItem === 'function';
    }
}
