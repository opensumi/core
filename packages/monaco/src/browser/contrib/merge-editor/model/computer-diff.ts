import { IDocumentDiff } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/documentDiffProvider';
import { RangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';
import { IEditorWorkerService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/editorWorker';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { DetailedLineRangeMapping } from '../../../../common/diff';
import { ITextModel } from '../../../monaco-api/types';

import { InnerRange } from './inner-range';
import { LineRange } from './line-range';

export class ComputerDiffModel {
  private editorWorkerService: IEditorWorkerService;

  constructor() {
    this.editorWorkerService = StandaloneServices.get(IEditorWorkerService);
  }

  /**
   * editorWorkerService.computeDiff 计算出的结果是一个简化的序列化数据，需要转换成含 range 类的对象
   */
  private convertDiffResult(result: IDocumentDiff): IDocumentDiff {
    return {
      identical: result.identical,
      quitEarly: result.quitEarly,
      moves: [],
      changes: result.changes.map(
        (c) =>
          new DetailedLineRangeMapping(
            new LineRange(c.original.startLineNumber, c.original.endLineNumberExclusive),
            new LineRange(c.modified.startLineNumber, c.modified.endLineNumberExclusive),
            c.innerChanges?.map(
              (c) =>
                new RangeMapping(
                  new InnerRange(
                    c.originalRange.startLineNumber,
                    c.originalRange.startColumn,
                    c.originalRange.endLineNumber,
                    c.originalRange.endColumn,
                  ),
                  new InnerRange(
                    c.modifiedRange.startLineNumber,
                    c.modifiedRange.startColumn,
                    c.modifiedRange.endLineNumber,
                    c.modifiedRange.endColumn,
                  ),
                ),
            ),
          ),
      ),
    };
  }

  public async computeDiff(model1: ITextModel, model2: ITextModel): Promise<IDocumentDiff> {
    const result = await this.editorWorkerService.computeDiff(
      model1.uri,
      model2.uri,
      {
        ignoreTrimWhitespace: false,
        maxComputationTimeMs: 0,
        computeMoves: false,
      },
      'advanced',
    );

    const empty = { quitEarly: false, identical: false, changes: [], moves: [] };

    if (model1.isDisposed() || model2.isDisposed()) {
      return empty;
    }

    if (result) {
      return this.convertDiffResult(result);
    }

    return empty;
  }
}
