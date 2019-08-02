import URI from 'vscode-uri/lib/umd';
import { ExtensionDocumentDataManager } from '../../common';
import * as Converter from '../../common/converter';
import * as vscode from 'vscode';
import { CompletionContext, Completion, CompletionDto, Position, CompletionItemInsertTextRule } from '../../common/model.api';
import { Range, SnippetString } from '../../common/ext-types';
import { mixin } from '../../common/utils';

export class CompletionAdapter {
    private cacheId = 0;
    private cache = new Map<number, vscode.CompletionItem[]>();

    constructor(private readonly delegate: vscode.CompletionItemProvider,
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
        // this.cache.set(this.cacheId++, result);
        return {
            isIncomplete: Array.isArray(result) ? false : result.isIncomplete,
            items: (Array.isArray(result) ? result : result.items).map((item) => {
                item.insertText = Converter.fromInsertText(item);
                // @ts-ignore
                item.range = item.range ? Converter.fromRange(item.range) : null;
                if (item.command) {
                    // 我们内部用的是id
                    // @ts-ignore
                    item.command.id = item.command.command;
                    if (item.command.arguments) {
                        // TODO 啥？
                        item.command.arguments.forEach((arg, i) => {
                            if (arg.command === item.command) {
                                arg.command = null;
                            }
                        });
                    }
                }
                return item;
            }),
        };
    }

    resolveCompletionItem(resource: URI, position: Position, completion: Completion, token: vscode.CancellationToken): Promise<Completion> {
        if (typeof this.delegate.resolveCompletionItem !== 'function') {
            return Promise.resolve(completion);
        }

        const { parentId, id } = ( completion as CompletionDto);
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

    private convertCompletionItem(item: vscode.CompletionItem, position: vscode.Position, defaultRange: vscode.Range, id: number, parentId: number): CompletionDto | undefined {
        if (typeof item.label !== 'string' || item.label.length === 0) {
            console.warn('Invalid Completion Item -> must have at least a label');
            return undefined;
        }

        const result: CompletionDto = {
            id,
            parentId,
            label: item.label,
            type: Converter.fromCompletionItemKind(item.kind),
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
