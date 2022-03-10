import type vscode from 'vscode';

import { Uri as URI } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import * as types from '../../../../common/vscode/ext-types';
import { Position, DocumentHighlight } from '../../../../common/vscode/model.api';

export class DocumentHighlightAdapter {
  constructor(
    private readonly provider: vscode.DocumentHighlightProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  provideDocumentHighlights(
    resource: URI,
    position: Position,
    token: vscode.CancellationToken,
  ): Promise<DocumentHighlight[] | undefined> {
    const documentData = this.documents.getDocumentData(resource);
    if (!documentData) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const document = documentData.document;
    const zeroBasedPosition = Converter.toPosition(position);

    return Promise.resolve(this.provider.provideDocumentHighlights(document, zeroBasedPosition, token)).then(
      (documentHighlights) => {
        if (!documentHighlights) {
          return undefined;
        }

        if (this.isDocumentHighlightArray(documentHighlights)) {
          const highlights: DocumentHighlight[] = [];

          for (const highlight of documentHighlights) {
            highlights.push(Converter.DocumentHighlight.from(highlight));
          }

          return highlights;
        }
      },
    );
  }

  /* tslint:disable-next-line:no-any */
  private isDocumentHighlightArray(array: any): array is types.DocumentHighlight[] {
    return Array.isArray(array) && array.length > 0 && array[0].range;
  }
}
