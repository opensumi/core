import { Uri as URI } from '@ali/ide-core-common';
import type vscode from 'vscode';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import { FoldingContext, FoldingRange } from '../../../../common/vscode/model.api';
import * as Converter from '../../../../common/vscode/converter';

export class FoldingProviderAdapter {

  constructor(
    private documents: ExtensionDocumentDataManager,
    private provider: vscode.FoldingRangeProvider,
  ) { }

  async provideFoldingRanges(resource: URI, context: FoldingContext, token: vscode.CancellationToken): Promise<FoldingRange[] | undefined> {
    const documentData = this.documents.getDocumentData(resource);
    if (!documentData) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }
    const doc = documentData.document;
    const ranges = await this.provider.provideFoldingRanges(doc, context, token);
    if (!Array.isArray(ranges)) {
      return undefined;
    }
    return ranges.map(Converter.fromFoldingRange);
  }
}
