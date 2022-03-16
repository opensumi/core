import type vscode from 'vscode';

import { Uri as URI } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as typeConvert from '../../../../common/vscode/converter';
import { Position, ISignatureHelpDto, SignatureHelpContextDto } from '../../../../common/vscode/model.api';

export class SignatureHelpAdapter {
  private cacheId = 0;
  private cache = new Map<number, vscode.SignatureHelp>();

  constructor(
    private readonly delegate: vscode.SignatureHelpProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  async provideSignatureHelp(
    resource: URI,
    position: Position,
    token: vscode.CancellationToken,
    context: SignatureHelpContextDto,
  ): Promise<ISignatureHelpDto | undefined> {
    const documentData = this.documents.getDocumentData(resource);
    if (!documentData) {
      return Promise.reject(new Error(`There are no document for  ${resource}`));
    }
    const cacheId = this.cacheId++;
    const document = documentData.document;
    const zeroBasedPosition = typeConvert.toPosition(position);
    const vscodeContext = this.reviveContext(context);
    const value = await this.delegate.provideSignatureHelp(document, zeroBasedPosition, token, vscodeContext);

    if (value) {
      this.cache.set(cacheId, value);
      return {
        ...typeConvert.SignatureHelp.from(value),
        id: cacheId,
      };
    }
  }

  private reviveContext(context: SignatureHelpContextDto): vscode.SignatureHelpContext {
    let activeSignatureHelp: vscode.SignatureHelp | undefined;
    if (context.activeSignatureHelp) {
      const revivedSignatureHelp = typeConvert.SignatureHelp.to(context.activeSignatureHelp);
      const saved = this.cache.get(context.activeSignatureHelp.id);
      if (saved) {
        activeSignatureHelp = saved;
        activeSignatureHelp.activeSignature = revivedSignatureHelp.activeSignature;
        activeSignatureHelp.activeParameter = revivedSignatureHelp.activeParameter;
      } else {
        activeSignatureHelp = revivedSignatureHelp;
      }
    }
    return { ...context, activeSignatureHelp };
  }

  releaseSignatureHelp(id: number): void {
    this.cache.delete(id);
  }
}
