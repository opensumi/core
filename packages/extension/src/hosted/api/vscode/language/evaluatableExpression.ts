import vscode from 'vscode';

import { asPromise, CancellationToken } from '@opensumi/ide-core-common';
import { Position } from '../../../../common/vscode/model.api';
import * as Converter from '../../../../common/vscode/converter';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import { IEvaluatableExpression } from '@opensumi/ide-debug/lib/common/evaluatable-expression';

export class EvaluatableExpressionAdapter {
  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.EvaluatableExpressionProvider,
  ) {}

  public provideEvaluatableExpression(
    resource: vscode.Uri,
    position: Position,
    token: CancellationToken,
  ): Promise<IEvaluatableExpression | undefined> {
    const doc = this._documents.getDocument(resource);
    if (!doc) {
      return Promise.resolve(undefined);
    }
    const pos = Converter.toPosition(position);

    return asPromise(() => this._provider.provideEvaluatableExpression(doc, pos, token)).then((value) => {
      if (value) {
        return Converter.EvaluatableExpression.from(value);
      }
      return undefined;
    });
  }
}
