import URI from 'vscode-uri/lib/umd';
import * as vscode from 'vscode';
import { ExtensionDocumentDataManager } from '../../common';
import { SignatureHelp, Position } from '../../common/model.api';
import * as Converter from '../../common/converter';

export class SignatureHelpAdapter {

    constructor(
        private readonly delegate: vscode.SignatureHelpProvider,
        private readonly documents: ExtensionDocumentDataManager) {

    }

    provideSignatureHelp(resource: URI, position: Position, token: vscode.CancellationToken): Promise<SignatureHelp | undefined> {
        const documentData = this.documents.getDocumentData(resource);
        if (!documentData) {
            return Promise.reject(new Error(`There are no document for  ${resource}`));
        }

        const document = documentData.document;
        const zeroBasedPosition = Converter.toPosition(position);

        return Promise.resolve(this.delegate.provideSignatureHelp(document, zeroBasedPosition, token));
    }

}
