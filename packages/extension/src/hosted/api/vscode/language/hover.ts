import type vscode from 'vscode';

import { Uri } from '@opensumi/ide-core-common';
import { IPosition } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import { Range } from '../../../../common/vscode/ext-types';

export class HoverAdapter {
  constructor(
    private readonly provider: vscode.HoverProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  provideHover(resource: Uri, position: IPosition, token: vscode.CancellationToken) {
    const documentData = this.documents.getDocumentData(resource.toString());
    if (!documentData) {
      return Promise.reject(new Error(`There are no document for ${resource}`));
    }
    const pos = Converter.toPosition(position);
    const doc = documentData.document;

    return Promise.resolve(this.provider.provideHover(doc, pos, token)).then((value) => {
      /* tslint:disable-next-line:no-any */
      if (!value || !Array.isArray(value.contents) || (value.contents as Array<any>).length === 0) {
        return undefined;
      }
      if (!value.range) {
        value.range = doc.getWordRangeAtPosition(pos);
      }
      if (!value.range) {
        value.range = new Range(pos, pos);
      }
      return Converter.fromHover(value);
    });
  }
}
