/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import URI from 'vscode-uri/lib/umd';
import { ExtensionDocumentDataManager } from '../../common';
import * as Converter from '../../common/coverter';
import * as vscode from 'vscode';
import { CompletionContext, CompletionResultDto, Completion, CompletionDto, Position } from '../../common/model.api';
import { CompletionList, Range, SnippetString } from '../../common/ext-types';
import { mixin } from '../../common/utils';

export class CompletionAdapter {
    private cacheId = 0;
    private cache = new Map<number, vscode.CompletionItem[]>();

    constructor(private readonly delegate: vscode.CompletionItemProvider,
                private readonly documents: ExtensionDocumentDataManager) {

    }

    provideCompletionItems(resource: URI, position: Position, context: CompletionContext, token: vscode.CancellationToken): Promise<CompletionResultDto | undefined> {
        const document = this.documents.getDocumentData(resource);
        if (!document) {
            return Promise.reject(new Error(`There are no document for  ${resource}`));
        }

        const doc = document.document;

        const pos = Converter.toPosition(position);
        return Promise.resolve(this.delegate.provideCompletionItems(doc, pos, token, context)).then((value) => {
            const id = this.cacheId++;
            const result: CompletionResultDto = {
                id,
                completions: [],
            };

            let list: CompletionList;
            if (!value) {
                return undefined;
            } else if (Array.isArray(value)) {
                list = new CompletionList(value);
            } else {
                list = value;
                result.incomplete = list.isIncomplete;
            }

            const wordRangeBeforePos = (doc.getWordRangeAtPosition(pos) as Range || new Range(pos, pos))
                .with({ end: pos });

            for (let i = 0; i < list.items.length; i++) {
                const suggestion = this.convertCompletionItem(list.items[i], pos, wordRangeBeforePos, i, id);
                if (suggestion) {
                    result.completions.push(suggestion);
                }
            }
            this.cache.set(id, list.items);

            return result;
        });
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
        };

        if (typeof item.insertText === 'string') {
            result.insertText = item.insertText;
            result.snippetType = 'internal';

        } else if (item.insertText instanceof SnippetString) {
            result.insertText = item.insertText.value;
            result.snippetType = 'textmate';

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
