import * as vscode from 'vscode';
import URI from 'vscode-uri';
import * as Converter from '../../../../common/vscode/converter';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import { DocumentLink, ILink } from '../../../../common/vscode/model.api';
import { ObjectIdentifier } from './util';

export class LinkProviderAdapter {
    private cacheId = 0;
    private cache = new Map<number, vscode.DocumentLink>();

    constructor(
        private readonly provider: vscode.DocumentLinkProvider,
        private readonly documents: ExtensionDocumentDataManager,
    ) { }

    provideLinks(resource: URI, token: vscode.CancellationToken): Promise<ILink[] | undefined> {
        const document = this.documents.getDocumentData(resource);
        if (!document) {
            return Promise.reject(new Error(`There is no document for ${resource}`));
        }

        const doc = document.document;

        return Promise.resolve(this.provider.provideDocumentLinks(doc, token)).then((links) => {
            if (!Array.isArray(links)) {
                return undefined;
            }
            const result: ILink[] = [];
            for (const link of links) {
                const data = Converter.fromDocumentLink(link);
                const id = this.cacheId++;
                ObjectIdentifier.mixin(data, id);
                this.cache.set(id, link);
                result.push(data);
            }
            return result;
        });
    }

    resolveLink(link: DocumentLink, token: vscode.CancellationToken): Promise<ILink | undefined> {
        if (typeof this.provider.resolveDocumentLink !== 'function') {
            return Promise.resolve(undefined);
        }
        const id = ObjectIdentifier.of(link);
        const item = this.cache.get(id);
        if (!item) {
            return Promise.resolve(undefined);
        }
        return Promise.resolve(this.provider.resolveDocumentLink(item, token)).then((value) => {
            if (value) {
                return Converter.fromDocumentLink(value);
            }
            return undefined;
        });
    }
}
