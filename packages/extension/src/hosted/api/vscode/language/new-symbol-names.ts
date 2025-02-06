import { Uri as URI } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import * as model from '../../../../common/vscode/model.api';

import type vscode from 'vscode';

export class NewSymbolNamesAdapter {
  constructor(
    private readonly provider: vscode.NewSymbolNamesProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  async provideNewSymbolNames(
    resource: URI,
    range: model.Range,
    triggerKind: vscode.NewSymbolNameTriggerKind,
    token: vscode.CancellationToken,
  ): Promise<vscode.NewSymbolName[] | undefined> {
    const document = this.documents.getDocumentData(resource);
    if (!document) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const doc = document.document;
    const rng = Converter.Range.to(range);

    const result = await this.provider.provideNewSymbolNames(doc, rng, triggerKind, token);
    if (result) {
      return result;
    }
  }
}
