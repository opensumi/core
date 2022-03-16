import type vscode from 'vscode';

import { getDebugLogger, Uri as URI } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as Converter from '../../../../common/vscode/converter';
import * as types from '../../../../common/vscode/ext-types';
import * as model from '../../../../common/vscode/model.api';
import { isObject } from '../../../../common/vscode/utils';

export class RenameAdapter {
  static supportsResolving(provider: vscode.RenameProvider): boolean {
    return typeof provider.prepareRename === 'function';
  }

  private readonly debug = getDebugLogger();

  constructor(
    private readonly provider: vscode.RenameProvider,
    private readonly documents: ExtensionDocumentDataManager,
  ) {}

  provideRenameEdits(
    resource: URI,
    position: model.Position,
    newName: string,
    token: vscode.CancellationToken,
  ): Promise<model.WorkspaceEditDto | undefined> {
    const document = this.documents.getDocumentData(resource);
    if (!document) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const doc = document.document;
    const pos = Converter.toPosition(position);

    return Promise.resolve(this.provider.provideRenameEdits(doc, pos, newName, token)).then(
      (value) => {
        if (!value) {
          return undefined;
        }

        return Converter.WorkspaceEdit.from(value);
      },
      (error) => {
        const rejectReason = RenameAdapter.asMessage(error);
        if (rejectReason) {
          return {
            rejectReason,
            edits: [],
          } as model.WorkspaceEditDto;
        } else {
          return Promise.reject<model.WorkspaceEditDto>(error);
        }
      },
    );
  }

  resolveRenameLocation(
    resource: URI,
    position: model.Position,
    token: vscode.CancellationToken,
  ): Promise<(model.RenameLocation & model.Rejection) | undefined> {
    if (typeof this.provider.prepareRename !== 'function') {
      return Promise.resolve(undefined);
    }

    const document = this.documents.getDocumentData(resource);
    if (!document) {
      return Promise.reject(new Error(`There is no document for ${resource}`));
    }

    const doc = document.document;
    const pos = Converter.toPosition(position);

    return Promise.resolve(this.provider.prepareRename(doc, pos, token)).then(
      (rangeOrLocation) => {
        let range: vscode.Range | undefined;
        let text: string | undefined;
        if (rangeOrLocation && types.Range.isRange(rangeOrLocation)) {
          range = rangeOrLocation;
          text = doc.getText(rangeOrLocation);
        } else if (rangeOrLocation && isObject(rangeOrLocation)) {
          range = rangeOrLocation.range;
          text = rangeOrLocation.placeholder;
        }

        if (!range || !text) {
          return undefined;
        }

        if (range.start.line > pos.line || range.end.line < pos.line) {
          this.debug.warn('INVALID rename location: position line must be within range start/end lines');
          return undefined;
        }
        return {
          range: Converter.fromRange(range),
          text,
        };
      },
      (error) => {
        const rejectReason = RenameAdapter.asMessage(error);
        if (rejectReason) {
          return Promise.resolve({
            rejectReason,
          } as model.RenameLocation & model.Rejection);
        } else {
          return Promise.reject(error);
        }
      },
    );
  }

  /* tslint:disable-next-line:no-any */
  private static asMessage(err: any): string | undefined {
    if (typeof err === 'string') {
      return err;
    } else if (err instanceof Error && typeof err.message === 'string') {
      return err.message;
    } else {
      return undefined;
    }
  }
}
