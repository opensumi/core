import React, { useCallback } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Disposable, Emitter, Event } from '@opensumi/ide-core-common';
import { EditorOption } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';

import { ICodeEditor } from '../../../monaco-api/types';
import { MergeEditorService } from '../merge-editor.service';
import { LineRange } from '../model/line-range';
import { StickyPieceModel } from '../model/sticky-piece';
import { EditorViewType, LineRangeType } from '../types';
import { flatModified, flatOriginal } from '../utils';

import { BaseCodeEditor } from './editors/baseCodeEditor';

const PieceSVG: React.FC<{ piece: StickyPieceModel }> = ({ piece }) => {
  const { leftTop, rightTop, leftBottom, rightBottom } = piece.path;

  const drawPath = useCallback(
    () => `M0,${leftTop} L${piece.width},${rightTop} L${piece.width},${rightBottom} L0,${leftBottom} z`,
    [leftTop, rightTop, rightBottom, leftBottom, piece.width],
  );

  return (
    <div className={'piece-view-lines'} style={{ top: piece.position.top, width: piece.width }}>
      <svg viewBox={`0 0 ${piece.width} ${piece.height}`} style={{ height: piece.height }}>
        <path className={piece.rangeType} d={drawPath()}></path>
      </svg>
    </div>
  );
};

export const WithViewStickinessConnectComponent: React.FC<{ contrastType: EditorViewType }> = ({ contrastType }) => {
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);
  const [pieces, setPieces] = React.useState<StickyPieceModel[]>([]);

  React.useEffect(() => {
    const disposables = new Disposable();

    disposables.addDispose(
      Event.filter(
        mergeEditorService.stickinessConnectManager.onDidChangePiece,
        ({ editorType }) => editorType === contrastType,
      )(({ pieces }) => {
        setPieces(pieces);
      }),
    );

    disposables.addDispose(
      mergeEditorService.scrollSynchronizer.onScrollChange(() => {
        const [leftOffest, rightOffest] =
          mergeEditorService.stickinessConnectManager.getScrollTopWithBoth(contrastType);

        const newPieces = pieces.map((p) => p.movePosition(leftOffest, rightOffest));

        setPieces(newPieces);
      }),
    );

    return () => disposables.dispose();
  }, [mergeEditorService, pieces]);

  return (
    <div className={'stickiness-connect-container'}>
      {pieces.map((p, i) => (
        <PieceSVG key={i} piece={p}></PieceSVG>
      ))}
    </div>
  );
};

export class StickinessConnectManager extends Disposable {
  private currentView: BaseCodeEditor | undefined;
  private resultView: BaseCodeEditor | undefined;
  private incomingView: BaseCodeEditor | undefined;

  private readonly _onDidChangePiece = new Emitter<{ pieces: StickyPieceModel[]; editorType: EditorViewType }>();
  public readonly onDidChangePiece: Event<{ pieces: StickyPieceModel[]; editorType: EditorViewType }> =
    this._onDidChangePiece.event;

  constructor() {
    super();
  }

  private generatePiece(
    origin: LineRange[],
    modify: LineRange[],
    editorLayoutInfo: { marginWidth: number; lineHeight: number },
    withBase: 0 | 1 = 0,
  ): StickyPieceModel[] {
    const result: StickyPieceModel[] = [];
    const { marginWidth, lineHeight } = editorLayoutInfo;

    origin.forEach((range, idx) => {
      const sameModify = modify[idx];
      const minTop = Math.min(range.startLineNumber, sameModify.startLineNumber);
      const maxBottom = Math.max(range.endLineNumberExclusive, sameModify.endLineNumberExclusive);
      const width = marginWidth;
      const height = lineHeight * (maxBottom - minTop);
      const position = {
        top: (minTop - 1) * lineHeight,
      };
      const path = {
        leftTop: Math.abs(minTop - range.startLineNumber) * lineHeight,
        rightTop: Math.abs(minTop - sameModify.startLineNumber) * lineHeight,
        leftBottom: (range.endLineNumberExclusive - minTop) * lineHeight,
        rightBottom: (sameModify.endLineNumberExclusive - minTop) * lineHeight,
      };

      let rangeType: LineRangeType = 'modify';

      if (range.isTendencyLeft(sameModify)) {
        rangeType = withBase === 0 ? 'insert' : 'remove';
      } else if (range.isTendencyRight(sameModify)) {
        rangeType = withBase === 0 ? 'remove' : 'insert';
      }

      result.push(new StickyPieceModel(width, height, path, position, rangeType));
    });

    return result;
  }

  private computePiece(editorType: EditorViewType) {
    if (editorType === 'result') {
      return;
    }

    if (!(this.currentView || this.resultView || this.incomingView)) {
      return;
    }

    const view = editorType === 'current' ? this.currentView : this.incomingView;

    const { computeResultRangeMapping } = view!;
    const [originRange, modifyRange] = [
      flatOriginal(computeResultRangeMapping),
      flatModified(computeResultRangeMapping),
    ];
    const lineHeight = view!.getEditor().getOption(EditorOption.lineHeight);
    const layoutInfo =
      editorType === 'current'
        ? this.resultView!.getEditor().getLayoutInfo()
        : this.incomingView!.getEditor().getLayoutInfo();

    let marginWidth: number = layoutInfo.contentLeft;

    const lineDecorationsWidth = (editorType === 'current' ? this.resultView : this.incomingView)!
      .getEditor()
      .getOption(EditorOption.lineDecorationsWidth);
    marginWidth -= typeof lineDecorationsWidth === 'number' ? lineDecorationsWidth : 0;

    const pieces = this.generatePiece(
      originRange,
      modifyRange,
      { marginWidth, lineHeight },
      editorType === 'incoming' ? 1 : 0,
    ).map((p) => p.movePosition(...this.getScrollTopWithBoth(editorType)));

    this._onDidChangePiece.fire({ pieces, editorType });
  }

  public getScrollTopWithBoth(contrastType: EditorViewType): [number, number] {
    if (contrastType === 'result') {
      return [0, 0];
    }

    if (!(this.currentView || this.resultView || this.incomingView)) {
      return [0, 0];
    }

    let leftEditor: ICodeEditor | undefined;
    let rightEditor: ICodeEditor | undefined;

    if (contrastType === 'current') {
      leftEditor = this.currentView!.getEditor();
      rightEditor = this.resultView!.getEditor();
    } else if (contrastType === 'incoming') {
      leftEditor = this.resultView!.getEditor();
      rightEditor = this.incomingView!.getEditor();
    }

    if (leftEditor && rightEditor) {
      return [leftEditor.getScrollTop(), rightEditor.getScrollTop()];
    }

    return [0, 0];
  }

  public mount(currentView: BaseCodeEditor, resultView: BaseCodeEditor, incomingView: BaseCodeEditor): void {
    this.currentView = currentView;
    this.resultView = resultView;
    this.incomingView = incomingView;

    this.addDispose(
      Event.debounce(
        currentView.onDidChangeDecorations,
        () => {},
        1,
      )(() => {
        this.computePiece('current');
      }),
    );

    this.addDispose(
      Event.debounce(
        incomingView.onDidChangeDecorations,
        () => {},
        1,
      )(() => {
        this.computePiece('incoming');
      }),
    );
  }
}
