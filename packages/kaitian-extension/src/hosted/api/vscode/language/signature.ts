import { Uri as URI } from '@ali/ide-core-common';
import type * as vscode from 'vscode';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import { Position, ISignatureHelpDto, SignatureHelp } from '../../../../common/vscode/model.api';
import * as Converter from '../../../../common/vscode/converter';

export class SignatureHelpAdapter {

  private cacheId: number = 0;
  private cache = new Map<number, SignatureHelp>();

  constructor(
    private readonly delegate: vscode.SignatureHelpProvider,
    private readonly documents: ExtensionDocumentDataManager) {
  }

  async provideSignatureHelp(resource: URI, position: Position, token: vscode.CancellationToken, context: vscode.SignatureHelpContext): Promise<ISignatureHelpDto | undefined> {
    const documentData = this.documents.getDocumentData(resource);
    if (!documentData) {
      return Promise.reject(new Error(`There are no document for  ${resource}`));
    }
    const cacheId = this.cacheId ++;
    const document = documentData.document;
    const zeroBasedPosition = Converter.toPosition(position);
    const value = await Promise.resolve(this.delegate.provideSignatureHelp(document, zeroBasedPosition, token, context));

    if (value) {
      this.cache.set(cacheId, value);
      return {
        ...value,
        id: cacheId,
      };
    }
  }

  releaseSignatureHelp(id: number): void {
    this.cache.delete(id);
  }
}
