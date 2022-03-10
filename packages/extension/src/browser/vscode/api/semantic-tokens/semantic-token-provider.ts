import * as model from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as modes from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IExtHostLanguages } from '../../../../common/vscode/languages';
import { decodeSemanticTokensDto } from '../../../../common/vscode/semantic-tokens';

function toUint8Array(arr: Array<number> | Uint8Array | ArrayLike<number>) {
  if (arr instanceof Uint8Array) {
    return arr;
  }
  if (Array.isArray(arr)) {
    return Uint8Array.from(arr);
  }

  const newArr: number[] = [];
  for (const k in arr) {
    if (Object.prototype.hasOwnProperty.call(arr, k)) {
      newArr.push(Number(arr[k]));
    }
  }
  return Uint8Array.from(newArr);
}

export class DocumentSemanticTokensProvider {
  constructor(
    private readonly proxy: IExtHostLanguages,
    public handleId: number,
    private legend: modes.SemanticTokensLegend,
  ) {}
  getLegend(): modes.SemanticTokensLegend {
    return this.legend;
  }

  async provideDocumentSemanticTokens(
    model: model.ITextModel,
    lastResultId: string | null,
    token: monaco.CancellationToken,
  ): Promise<modes.SemanticTokens | modes.SemanticTokensEdits | null> {
    const nLastResultId = lastResultId ? parseInt(lastResultId, 10) : 0;
    const encodedDto = await this.proxy.$provideDocumentSemanticTokens(this.handleId, model.uri, nLastResultId, token);
    if (!encodedDto) {
      return null;
    }
    if (token.isCancellationRequested) {
      return null;
    }
    // 这里经过通信层的 JSON.stringify , 实际 Uint8Array 会被转换为对象，需要再转回来
    const dto = decodeSemanticTokensDto(toUint8Array(encodedDto));
    if (dto.type === 'full') {
      return {
        resultId: String(dto.id),
        data: dto.data,
      };
    }
    return {
      resultId: String(dto.id),
      edits: dto.deltas,
    };
  }

  releaseDocumentSemanticTokens(resultId: string | undefined): void {
    if (resultId) {
      this.proxy.$releaseDocumentSemanticTokens(this.handleId, parseInt(resultId, 10));
    }
  }
}

export class DocumentRangeSemanticTokensProviderImpl implements modes.DocumentRangeSemanticTokensProvider {
  constructor(
    private readonly proxy: IExtHostLanguages,
    public handleId: number,
    private legend: monaco.languages.SemanticTokensLegend,
  ) {}

  getLegend() {
    return this.legend;
  }

  async provideDocumentRangeSemanticTokens(
    model: model.ITextModel,
    range: monaco.Range,
    token: monaco.CancellationToken,
  ): Promise<monaco.languages.SemanticTokens | null> {
    const encodedDto = await this.proxy.$provideDocumentRangeSemanticTokens(this.handleId, model.uri, range, token);
    if (!encodedDto) {
      return null;
    }
    if (token.isCancellationRequested) {
      return null;
    }
    const dto = decodeSemanticTokensDto(toUint8Array(encodedDto));
    if (dto.type === 'full') {
      return {
        resultId: String(dto.id),
        data: dto.data,
      };
    }
    throw new Error('Unexpected');
  }
}
