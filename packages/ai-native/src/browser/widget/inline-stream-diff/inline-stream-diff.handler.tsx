import { Injectable } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-browser';
import { ICodeEditor, IEditorDecorationsCollection, ITextModel, Range, Selection } from '@opensumi/ide-monaco';
import { StandaloneServices } from '@opensumi/ide-monaco/lib/browser/monaco-api/services';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/lineRange';
import { linesDiffComputers } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputers';
import { DetailedLineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';

import styles from './inline-stream-diff.module.less';

interface IRangeChangeData {
  removedTextLines: string[];
  removedLinesOriginalRange: LineRange;
  addedRange: LineRange;
  relativeInnerChanges:
    | {
        originalRange: Range;
        modifiedRange: Range;
      }[]
    | undefined;
}

interface IComputeDiffData {
  newFullRangeTextLines: string[];
  changes: IRangeChangeData[];
  activeLine: number;
  pendingRange: LineRange;
}

class DecorationModel {
  private zoneDec: IEditorDecorationsCollection;

  private activeLineDec: IEditorDecorationsCollection;
  private addedRangeDec: IEditorDecorationsCollection;
  private pendingRangeDec: IEditorDecorationsCollection;

  constructor(private readonly monacoEditor: ICodeEditor) {
    this.zoneDec = this.monacoEditor.createDecorationsCollection();

    this.activeLineDec = this.monacoEditor.createDecorationsCollection();
    this.addedRangeDec = this.monacoEditor.createDecorationsCollection();
    this.pendingRangeDec = this.monacoEditor.createDecorationsCollection();
  }

  public setZone(selection: Selection): void {
    this.zoneDec.set([
      {
        range: Range.fromPositions(
          { lineNumber: selection.startLineNumber, column: Number.MAX_SAFE_INTEGER },
          { lineNumber: selection.endLineNumber, column: Number.MAX_SAFE_INTEGER },
        ),
        options: ModelDecorationOptions.register({
          description: 'zone-decoration',
        }),
      },
    ]);
  }

  public touchActiveLine(lineNumber: number) {
    this.activeLineDec.set([
      {
        range: Range.fromPositions({
          lineNumber: this.zoneDec.getRange(0)!.startLineNumber + lineNumber,
          column: Number.MAX_SAFE_INTEGER,
        }),
        options: ModelDecorationOptions.register({
          description: 'activeLine-decoration',
          isWholeLine: true,
          className: styles.inline_diff_current,
        }),
      },
    ]);
  }

  public touchAddedRange(range: LineRange) {}

  public clearActiveLine() {
    this.activeLineDec.clear();
  }
}

@Injectable({ multiple: true })
export class InlineStreamDiffHandler extends Disposable {
  private modifiedModel: ITextModel;
  private originalTextLines: string[];
  private decorationModel: DecorationModel;

  constructor(private readonly monacoEditor: ICodeEditor, private readonly selection: Selection) {
    super();

    const modelService = StandaloneServices.get(IModelService);
    this.modifiedModel = modelService.createModel('', null);

    const originalModel = this.monacoEditor.getModel()!;
    this.originalTextLines = Array.from({
      length: this.selection.endLineNumber - this.selection.startLineNumber + 1,
    }).map((_, i) => originalModel.getLineContent(this.selection.startLineNumber + i));

    this.decorationModel = new DecorationModel(this.monacoEditor);
    this.decorationModel.setZone(this.selection);
  }

  private computeDiff(originalTextLines: string[], newTextLines: string[]): IComputeDiffData {
    const computeResult = linesDiffComputers.getDefault().computeDiff(originalTextLines, newTextLines, {
      computeMoves: false,
      maxComputationTimeMs: 200,
      ignoreTrimWhitespace: false,
    });

    let changes = computeResult.changes;

    if (computeResult.hitTimeout) {
      changes = [
        new DetailedLineRangeMapping(
          new LineRange(1, originalTextLines.length + 1),
          new LineRange(1, newTextLines.length + 1),
          undefined,
        ),
      ];
    }

    const resultChanges: IRangeChangeData[] = [];
    let removedTextLines: string[] = [];

    for (const change of changes) {
      removedTextLines = originalTextLines.slice(
        change.original.startLineNumber - 1,
        change.original.endLineNumberExclusive - 1,
      );

      if (change.modified.endLineNumberExclusive === newTextLines.length + 1) {
        if (change.modified.isEmpty) {
          continue;
        }

        resultChanges.push({
          removedTextLines: [],
          removedLinesOriginalRange: new LineRange(change.original.startLineNumber, change.original.startLineNumber),
          addedRange: change.modified,
          relativeInnerChanges: undefined,
        });
      } else {
        resultChanges.push({
          removedTextLines,
          removedLinesOriginalRange: change.original,
          addedRange: change.modified,
          relativeInnerChanges: change.innerChanges
            ? change.innerChanges.map((innerChange) => ({
                originalRange: innerChange.originalRange.delta(-change.original.startLineNumber + 1),
                modifiedRange: innerChange.modifiedRange.delta(-change.modified.startLineNumber + 1),
              }))
            : undefined,
        });
      }
    }

    const newFullRangeTextLines = [...newTextLines, ...removedTextLines];

    let activeLine: number = 0;
    let pendingRange = new LineRange(1, 1);

    if (removedTextLines.length > 0) {
      activeLine = newTextLines.length + 1;
      pendingRange = new LineRange(newTextLines.length + 1, newTextLines.length + 1 + removedTextLines.length);
    }

    return {
      changes: resultChanges,
      newFullRangeTextLines,
      activeLine,
      pendingRange,
    };
  }

  private handleDecorationRender(diffModel: IComputeDiffData): void {
    const { activeLine } = diffModel;

    /**
     * handler active line decoration
     */
    if (activeLine > 0) {
      this.decorationModel.touchActiveLine(activeLine);
    } else {
      this.decorationModel.clearActiveLine();
    }

    /**
     * handler add range
     */
  }

  public addLinesToDiff(newText: string): void {
    const lastLine = this.modifiedModel.getLineCount();
    const lastColumn = this.modifiedModel.getLineMaxColumn(lastLine);

    const range = new Range(lastLine, lastColumn, lastLine, lastColumn);

    const edit = {
      range,
      text: newText,
    };
    this.modifiedModel.pushEditOperations(null, [edit], () => null);

    const newTextLines = this.modifiedModel.getLinesContent();

    const diffModel = this.computeDiff(this.originalTextLines, newTextLines);
    this.handleDecorationRender(diffModel);
    // console.log('compute diff:>>>> result >>>>>>>>>>>> newDiff', diffModel)
  }
}
