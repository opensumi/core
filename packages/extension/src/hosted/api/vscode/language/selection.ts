import type vscode from 'vscode';

import { Uri as URI } from '@opensumi/ide-core-common';
import { isNonEmptyArray } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import { Position, SelectionRange } from '../../../../common/vscode/model.api';

export class SelectionRangeAdapter {
  constructor(
    private readonly documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.SelectionRangeProvider,
  ) {}

  async provideSelectionRanges(
    resource: URI,
    pos: Position[],
    token: vscode.CancellationToken,
  ): Promise<SelectionRange[][]> {
    const documentData = this.documents.getDocumentData(resource);
    if (!documentData) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }
    const doc = documentData.document;
    const zeroBasedPositions = pos.map(Converter.toPosition);

    const allProviderRanges = await this._provider.provideSelectionRanges(doc, zeroBasedPositions, token);
    if (!isNonEmptyArray(allProviderRanges)) {
      return [];
    }
    if (allProviderRanges.length !== zeroBasedPositions.length) {
      // eslint-disable-next-line no-console
      console.warn('BAD selection ranges, provider must return ranges for each position');
      return [];
    }

    const allResults: SelectionRange[][] = [];
    for (let i = 0; i < zeroBasedPositions.length; i++) {
      const oneResult: SelectionRange[] = [];
      allResults.push(oneResult);

      let last: vscode.Position | vscode.Range = zeroBasedPositions[i];
      let selectionRange = allProviderRanges[i];

      while (true) {
        if (!selectionRange.range.contains(last)) {
          throw new Error('INVALID selection range, must contain the previous range');
        }
        oneResult.push(Converter.fromSelectionRange(selectionRange));
        if (!selectionRange.parent) {
          break;
        }
        last = selectionRange.range;
        selectionRange = selectionRange.parent;
      }
    }
    return allResults;
  }
}
