import type vscode from 'vscode';

import { Uri, CancellationToken, IPosition, asPromise, coalesce } from '@opensumi/ide-core-common';
import type * as modes from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as typeConvert from '../../../../common/vscode/converter';

export class LinkedEditingRangeAdapter {
  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.LinkedEditingRangeProvider,
  ) {}

  provideLinkedEditingRanges(
    resource: Uri,
    position: IPosition,
    token: CancellationToken,
  ): Promise<modes.LinkedEditingRanges | undefined> {
    const doc = this._documents.getDocument(resource);

    if (!doc) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }
    const pos = typeConvert.Position.to(position);

    return asPromise(() => this._provider.provideLinkedEditingRanges(doc, pos, token)).then((value) => {
      if (value && Array.isArray(value.ranges)) {
        return {
          ranges: coalesce(value.ranges.map(typeConvert.Range.from)),
          wordPattern: value.wordPattern,
        };
      }
      return undefined;
    });
  }
}
