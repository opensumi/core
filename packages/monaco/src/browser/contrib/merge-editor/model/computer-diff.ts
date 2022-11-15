import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { IDocumentDiff } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/documentDiffProvider';
import {
  LineRange,
  LineRangeMapping,
  RangeMapping,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import {
  IEditorWorkerService,
  IDiffComputationResult,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/editorWorker';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { ITextModel } from '../../../monaco-api/types';

export class ComputerDiffModel {
  private editorWorkerService: IEditorWorkerService;

  constructor() {
    this.editorWorkerService = StandaloneServices.get(IEditorWorkerService);
  }

  /**
   * editorWorkerService.computeDiff 计算出的结果是一个简化的序列化数据，需要转换成含 range 类的对象
   */
  private convertDiffResult(result: IDiffComputationResult): IDocumentDiff {
    return {
      identical: result.identical,
      quitEarly: result.quitEarly,
      changes: result.changes.map(
        (c) =>
          new LineRangeMapping(
            new LineRange(c[0], c[1]),
            new LineRange(c[2], c[3]),
            c[4]?.map((c) => new RangeMapping(new Range(c[0], c[1], c[2], c[3]), new Range(c[4], c[5], c[6], c[7]))),
          ),
      ),
    };
  }

  public async computeDiff(model1: ITextModel, model2: ITextModel): Promise<IDocumentDiff> {
    const result = await this.editorWorkerService.computeDiff(model1.uri, model2.uri, {
      ignoreTrimWhitespace: false,
      maxComputationTime: 0,
      diffAlgorithm: 'experimental',
    });

    const empty = { quitEarly: false, identical: false, changes: [] };

    if (model1.isDisposed() || model2.isDisposed()) {
      return empty;
    }

    if (result) {
      const convert = this.convertDiffResult(result);
      return {
        identical: convert.identical,
        quitEarly: convert.quitEarly,
        changes: convert.changes.map((m) =>
          // let originalStartLineNumber: number;
          // let originalEndLineNumber: number;
          // let modifiedStartLineNumber: number;
          // let modifiedEndLineNumber: number;

          // if (m.originalRange.isEmpty) {
          //   originalStartLineNumber = m.originalRange.startLineNumber - 1;
          //   originalEndLineNumber = 0;
          // } else {
          //   originalStartLineNumber = m.originalRange.startLineNumber;
          //   originalEndLineNumber = m.originalRange.endLineNumberExclusive - 1;
          // }

          // if (m.modifiedRange.isEmpty) {
          //   modifiedStartLineNumber = m.modifiedRange.startLineNumber - 1;
          //   modifiedEndLineNumber = 0;
          // } else {
          //   modifiedStartLineNumber = m.modifiedRange.startLineNumber;
          //   modifiedEndLineNumber = m.modifiedRange.endLineNumberExclusive - 1;
          // }

           m
        ),
      };
    }

    return empty;
  }
}
