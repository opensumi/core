import URI from 'vscode-uri/lib/umd';
import * as vscode from 'vscode';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import { SignatureHelp, Position } from '../../../../common/vscode/model.api';
import * as Converter from '../../../../common/vscode/converter';

export class SignatureHelpAdapter {

    constructor(
        private readonly delegate: vscode.SignatureHelpProvider,
        private readonly documents: ExtensionDocumentDataManager) {

    }

    provideSignatureHelp(resource: URI, position: Position, token: vscode.CancellationToken, context: vscode.SignatureHelpContext): Promise<SignatureHelp | undefined | null> {
        const documentData = this.documents.getDocumentData(resource);
        if (!documentData) {
            return Promise.reject(new Error(`There are no document for  ${resource}`));
        }

        const document = documentData.document;
        const zeroBasedPosition = Converter.toPosition(position);

        return Promise.resolve(this.delegate.provideSignatureHelp(document, zeroBasedPosition, token, context));
    }

}
