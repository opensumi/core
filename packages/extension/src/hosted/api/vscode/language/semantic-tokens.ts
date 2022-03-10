import vscode from 'vscode';

import { CancellationToken, IRange } from '@opensumi/ide-core-common';

import { ExtensionDocumentDataManager } from '../../../../common/vscode';
import * as TypeConverts from '../../../../common/vscode/converter';
import { SemanticTokens, SemanticTokensEdit, SemanticTokensEdits, Uri } from '../../../../common/vscode/ext-types';
import { encodeSemanticTokensDto } from '../../../../common/vscode/semantic-tokens';

class SemanticTokensPreviousResult {
  constructor(public readonly resultId: string | undefined, public readonly tokens?: Uint32Array) {}
}

interface RelaxedSemanticTokens {
  readonly resultId?: string;
  readonly data: number[];
}
interface RelaxedSemanticTokensEdit {
  readonly start: number;
  readonly deleteCount: number;
  readonly data?: number[];
}
interface RelaxedSemanticTokensEdits {
  readonly resultId?: string;
  readonly edits: RelaxedSemanticTokensEdit[];
}

type ProvidedSemanticTokens = vscode.SemanticTokens | RelaxedSemanticTokens;
type ProvidedSemanticTokensEdits = vscode.SemanticTokensEdits | RelaxedSemanticTokensEdits;

export class DocumentSemanticTokensAdapter {
  private readonly _previousResults: Map<number, SemanticTokensPreviousResult>;
  private _nextResultId = 1;

  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.DocumentSemanticTokensProvider,
  ) {
    this._previousResults = new Map<number, SemanticTokensPreviousResult>();
  }

  async provideDocumentSemanticTokens(
    resource: Uri,
    previousResultId: number,
    token: CancellationToken,
  ): Promise<Uint8Array | null> {
    const doc = this._documents.getDocument(resource);
    const previousResult = previousResultId !== 0 ? this._previousResults.get(previousResultId) : null;
    let value =
      typeof previousResult?.resultId === 'string' &&
      typeof this._provider.provideDocumentSemanticTokensEdits === 'function'
        ? await this._provider.provideDocumentSemanticTokensEdits(doc!, previousResult.resultId, token)
        : await this._provider.provideDocumentSemanticTokens(doc!, token);

    if (previousResult) {
      this._previousResults.delete(previousResultId);
    }
    if (!value) {
      return null;
    }
    value = DocumentSemanticTokensAdapter._fixProvidedSemanticTokens(value);
    return this._send(DocumentSemanticTokensAdapter._convertToEdits(previousResult, value), value);
  }

  async releaseDocumentSemanticColoring(semanticColoringResultId: number): Promise<void> {
    this._previousResults.delete(semanticColoringResultId);
  }

  private static _fixProvidedSemanticTokens(
    v: ProvidedSemanticTokens | ProvidedSemanticTokensEdits,
  ): vscode.SemanticTokens | vscode.SemanticTokensEdits {
    if (DocumentSemanticTokensAdapter._isSemanticTokens(v)) {
      if (DocumentSemanticTokensAdapter._isCorrectSemanticTokens(v)) {
        return v;
      }
      return new SemanticTokens(new Uint32Array(v.data), v.resultId);
    } else if (DocumentSemanticTokensAdapter._isSemanticTokensEdits(v)) {
      if (DocumentSemanticTokensAdapter._isCorrectSemanticTokensEdits(v)) {
        return v;
      }
      return new SemanticTokensEdits(
        v.edits.map(
          (edit) =>
            new SemanticTokensEdit(edit.start, edit.deleteCount, edit.data ? new Uint32Array(edit.data) : edit.data),
        ),
        v.resultId,
      );
    }
    return v;
  }

  private static _isSemanticTokens(
    v: ProvidedSemanticTokens | ProvidedSemanticTokensEdits,
  ): v is ProvidedSemanticTokens {
    return v && !!(v as vscode.SemanticTokens).data;
  }

  private static _isSemanticTokensEdits(
    v: ProvidedSemanticTokens | ProvidedSemanticTokensEdits,
  ): v is ProvidedSemanticTokensEdits {
    return v && Array.isArray((v as vscode.SemanticTokensEdits).edits);
  }

  private static _isCorrectSemanticTokens(v: ProvidedSemanticTokens): v is vscode.SemanticTokens {
    return v.data instanceof Uint32Array;
  }

  private static _isCorrectSemanticTokensEdits(v: ProvidedSemanticTokensEdits): v is vscode.SemanticTokensEdits {
    for (const edit of v.edits) {
      if (!(edit.data instanceof Uint32Array)) {
        return false;
      }
    }
    return true;
  }

  private static _convertToEdits(
    previousResult: SemanticTokensPreviousResult | null | undefined,
    newResult: vscode.SemanticTokens | vscode.SemanticTokensEdits,
  ): vscode.SemanticTokens | vscode.SemanticTokensEdits {
    if (!DocumentSemanticTokensAdapter._isSemanticTokens(newResult)) {
      return newResult;
    }
    if (!previousResult || !previousResult.tokens) {
      return newResult;
    }
    const oldData = previousResult.tokens;
    const oldLength = oldData.length;
    const newData = newResult.data;
    const newLength = newData.length;

    let commonPrefixLength = 0;
    const maxCommonPrefixLength = Math.min(oldLength, newLength);
    while (commonPrefixLength < maxCommonPrefixLength && oldData[commonPrefixLength] === newData[commonPrefixLength]) {
      commonPrefixLength++;
    }

    if (commonPrefixLength === oldLength && commonPrefixLength === newLength) {
      // complete overlap!
      return new SemanticTokensEdits([], newResult.resultId);
    }

    let commonSuffixLength = 0;
    const maxCommonSuffixLength = maxCommonPrefixLength - commonPrefixLength;
    while (
      commonSuffixLength < maxCommonSuffixLength &&
      oldData[oldLength - commonSuffixLength - 1] === newData[newLength - commonSuffixLength - 1]
    ) {
      commonSuffixLength++;
    }

    return new SemanticTokensEdits(
      [
        {
          start: commonPrefixLength,
          deleteCount: oldLength - commonPrefixLength - commonSuffixLength,
          data: newData.subarray(commonPrefixLength, newLength - commonSuffixLength),
        },
      ],
      newResult.resultId,
    );
  }

  private _send(
    value: vscode.SemanticTokens | vscode.SemanticTokensEdits,
    original: vscode.SemanticTokens | vscode.SemanticTokensEdits,
  ): Uint8Array | null {
    if (DocumentSemanticTokensAdapter._isSemanticTokens(value)) {
      const myId = this._nextResultId++;
      this._previousResults.set(myId, new SemanticTokensPreviousResult(value.resultId, value.data));
      const result = encodeSemanticTokensDto({
        id: myId,
        type: 'full',
        data: value.data,
      });
      return result;
    }

    if (DocumentSemanticTokensAdapter._isSemanticTokensEdits(value)) {
      const myId = this._nextResultId++;
      if (DocumentSemanticTokensAdapter._isSemanticTokens(original)) {
        // store the original
        this._previousResults.set(myId, new SemanticTokensPreviousResult(original.resultId, original.data));
      } else {
        this._previousResults.set(myId, new SemanticTokensPreviousResult(value.resultId));
      }

      const result = encodeSemanticTokensDto({
        id: myId,
        type: 'delta',
        deltas: (value.edits || []).map((edit) => ({
          start: edit.start,
          deleteCount: edit.deleteCount,
          data: edit.data,
        })),
      });
      return result;
    }

    return null;
  }
}

export class DocumentRangeSemanticTokensAdapter {
  constructor(
    private readonly _documents: ExtensionDocumentDataManager,
    private readonly _provider: vscode.DocumentRangeSemanticTokensProvider,
  ) {}

  async provideDocumentRangeSemanticTokens(
    resource: Uri,
    range: IRange,
    token: CancellationToken,
  ): Promise<Uint8Array | null> {
    const doc = this._documents.getDocument(resource);
    const value = await this._provider.provideDocumentRangeSemanticTokens(doc!, TypeConverts.Range.to(range), token);
    if (!value) {
      return null;
    }
    return this._send(value);
  }

  private _send(value: vscode.SemanticTokens): Uint8Array | null {
    return encodeSemanticTokensDto({
      id: 0,
      type: 'full',
      data: value.data,
    });
  }
}
