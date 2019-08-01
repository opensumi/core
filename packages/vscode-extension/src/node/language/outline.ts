import URI from 'vscode-uri/lib/umd';
import * as vscode from 'vscode';
import { ExtensionDocumentDataManager } from '../../common';
import { DocumentSymbol, Range } from '../../common/model.api';
import * as types from '../../common/ext-types';
import * as Converter from '../../common/converter';

/** Adapts the calls from main to extension thread for providing the document symbols. */
export class OutlineAdapter {

    constructor(
        private readonly documents: ExtensionDocumentDataManager,
        private readonly provider: vscode.DocumentSymbolProvider,
    ) { }

    provideDocumentSymbols(resource: URI, token: vscode.CancellationToken): Promise<DocumentSymbol[] | undefined> {
        const document = this.documents.getDocumentData(resource);
        if (!document) {
            return Promise.reject(new Error(`There is no document for ${resource}`));
        }

        const doc = document.document;

        return Promise.resolve(this.provider.provideDocumentSymbols(doc, token)).then((value) => {
            if (!value || value.length === 0) {
                return undefined;
            }
            if (value[0] instanceof types.DocumentSymbol) {
                return ( value as types.DocumentSymbol[]).map(Converter.fromDocumentSymbol);
            } else {
                return OutlineAdapter.asDocumentSymbolTree(resource,  value as types.SymbolInformation[]);
            }
        });
    }

    private static asDocumentSymbolTree(resource: URI, info: types.SymbolInformation[]): DocumentSymbol[] {
        // first sort by start (and end) and then loop over all elements
        // and build a tree based on containment.
        info = info.slice(0).sort((a, b) => {
            let r = a.location.range.start.compareTo(b.location.range.start);
            if (r === 0) {
                r = b.location.range.end.compareTo(a.location.range.end);
            }
            return r;
        });
        const res: DocumentSymbol[] = [];
        const parentStack: DocumentSymbol[] = [];
        // tslint:disable
        for (let i = 0; i < info.length; i++) {
            const element =  {
                name: info[i].name,
                detail: '',
                kind: Converter.SymbolKind.fromSymbolKind(info[i].kind),
                containerName: info[i].containerName,
                range: Converter.fromRange(info[i].location.range),
                selectionRange: Converter.fromRange(info[i].location.range),
                children: [],
            } as DocumentSymbol;

            while (true) {
                if (parentStack.length === 0) {
                    parentStack.push(element);
                    res.push(element);
                    break;
                }
                const parent = parentStack[parentStack.length - 1];
                if (OutlineAdapter.containsRange(parent.range, element.range) && !OutlineAdapter.equalsRange(parent.range, element.range)) {
                    parent.children!.push(element);
                    parentStack.push(element);
                    break;
                }
                parentStack.pop();
            }
        }
        return res;
    }

    /**
     * Test if `otherRange` is in `range`. If the ranges are equal, will return true.
     */
    private static containsRange(range: Range, otherRange: Range): boolean {
        if (otherRange.startLineNumber < range.startLineNumber || otherRange.endLineNumber < range.startLineNumber) {
            return false;
        }
        if (otherRange.startLineNumber > range.endLineNumber || otherRange.endLineNumber > range.endLineNumber) {
            return false;
        }
        if (otherRange.startLineNumber === range.startLineNumber && otherRange.startColumn < range.startColumn) {
            return false;
        }
        if (otherRange.endLineNumber === range.endLineNumber && otherRange.endColumn > range.endColumn) {
            return false;
        }
        return true;
    }

    /**
     * Test if range `a` equals `b`.
     */
    private static equalsRange(a: Range, b: Range): boolean {
        return (
            !!a &&
            !!b &&
            a.startLineNumber === b.startLineNumber &&
            a.startColumn === b.startColumn &&
            a.endLineNumber === b.endLineNumber &&
            a.endColumn === b.endColumn
        );
    }
}
