import { Uri, CancellationToken, IRange } from '@ali/ide-core-common';
import type vscode from 'vscode';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as typeConvert from '../../../../common/vscode/converter';

export class InlayHintsAdapter {
  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.InlayHintsProvider,
  ) { }

  async provideInlayHints(resource: Uri, range: IRange, token: CancellationToken) {
    const doc = this._documents.getDocument(resource);
    const value = await this._provider.provideInlayHints(doc!, typeConvert.Range.to(range), token);
    return value ? { hints: value.map(typeConvert.InlayHint.from) } : undefined;
  }
}
