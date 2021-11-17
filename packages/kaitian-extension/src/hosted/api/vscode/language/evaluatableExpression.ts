import vscode from 'vscode';

import { asPromise, CancellationToken } from '@ide-framework/ide-core-common';
import { Position } from '../../../../common/vscode/model.api';
import * as Converter from '../../../../common/vscode/converter';
import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import { IEvaluatableExpression } from '@ide-framework/ide-debug/lib/common/evaluatable-expression';

export class EvaluatableExpressionAdapter {

  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.EvaluatableExpressionProvider,
  ) { }

  public provideEvaluatableExpression(resource: vscode.Uri, position: Position, token: CancellationToken): Promise<IEvaluatableExpression | undefined> {

    const doc = this._documents.getDocument(resource);
    const pos = Converter.toPosition(position);

    return asPromise(() => this._provider.provideEvaluatableExpression(doc!, pos, token)).then((value) => {
      if (value) {
        return Converter.EvaluatableExpression.from(value);
      }
      return undefined;
    });
  }
}
