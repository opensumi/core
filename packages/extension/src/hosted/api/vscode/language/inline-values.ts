import type vscode from 'vscode';

import { Uri, CancellationToken, IRange } from '@opensumi/ide-core-common';
import { asPromise } from '@opensumi/ide-core-common';
import { InlineValue } from '@opensumi/ide-debug/lib/common/inline-values';

import { ExtensionDocumentDataManager, IInlineValueContextDto } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';

export class InlineValuesAdapter {
  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.InlineValuesProvider,
  ) {}

  public provideInlineValues(
    resource: Uri,
    viewPort: IRange,
    context: IInlineValueContextDto,
    token: CancellationToken,
  ): Promise<InlineValue[] | undefined> {
    const doc = this._documents.getDocument(resource);
    return asPromise(() =>
      this._provider.provideInlineValues(
        doc!,
        Converter.toRange(viewPort),
        Converter.InlineValueContext.to(context),
        token,
      ),
    ).then((value) => {
      if (Array.isArray(value)) {
        return value.map((iv) => Converter.InlineValue.from(iv));
      }
      return undefined;
    });
  }
}
