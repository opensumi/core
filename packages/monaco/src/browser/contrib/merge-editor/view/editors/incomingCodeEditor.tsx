import { Injectable } from '@opensumi/di';
import { IEditorMouseEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { DocumentMapping } from '../../model/document-mapping';
import { LineRangeMapping } from '../../model/line-range-mapping';
import { ACCEPT_CURRENT, CONFLICT_ACTIONS_ICON, EDiffRangeTurn, EditorViewType, IGNORE } from '../../types';
import { flatInnerModified, flatModified } from '../../utils';
import { GuidelineWidget } from '../guideline-widget';

import { BaseCodeEditor } from './baseCodeEditor';
import { ResultCodeEditor } from './resultCodeEditor';

@Injectable({ multiple: false })
export class IncomingCodeEditor extends BaseCodeEditor {
  public documentMapping: DocumentMapping;

  public override mount(): void {
    super.mount();

    this.documentMapping = this.injector.get(DocumentMapping, [this, EDiffRangeTurn.MODIFIED]);
  }

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { readOnly: true, lineDecorationsWidth: 42 };
  }

  protected getRetainDecoration(): IDiffDecoration[] {
    return [];
  }

  protected getRetainLineWidget(): GuidelineWidget[] {
    return [];
  }

  private onActionsClick(
    e: IEditorMouseEvent,
    currentView: BaseCodeEditor,
    resultView: ResultCodeEditor,
    incomingView: BaseCodeEditor,
  ): boolean {
    const element = e.target.element!;
    const position = e.target.position;

    if (element.classList.contains(ACCEPT_CURRENT) && position) {
      const action = this.conflictActions.getActions(position.lineNumber);
      if (!action) {
        return false;
      }

      const { range } = action;
      const sameRange = resultView.documentMappingTurnRight.adjacentComputeRangeMap.get(range.id);

      const applyText = incomingView.getModel()!.getValueInRange(range.toRange());

      if (sameRange) {
        this.conflictActions.applyLineRangeEdits(resultView.getModel()!, [
          {
            range: range.isEmpty ? sameRange.deltaStart(-1).toRange(Number.MAX_SAFE_INTEGER) : sameRange.toRange(),
            text: applyText + (sameRange.isEmpty ? '\n' : ''),
          },
        ]);

        this.documentMapping.deltaAdjacentQueue(range, range.calcMargin(sameRange));
        resultView.documentMappingTurnRight.deltaAdjacentQueue(range, range.calcMargin(sameRange));

        this.documentMapping.computeRangeMap.delete(range.id);
        this.updateDecorations();

        resultView.documentMappingTurnRight.adjacentComputeRangeMap.delete(range.id);
        resultView.updateDecorations();
        this.conflictActions.clearActions(position.lineNumber);
        return true;
      }
    }

    if (element.classList.contains(IGNORE)) {
      // not implement
      return false;
    }

    return false;
  }

  public getMonacoDecorationOptions(
    preDecorations: IModelDecorationOptions,
  ): Omit<IModelDecorationOptions, 'description'> {
    return {
      linesDecorationsClassName: preDecorations.className,
    };
  }

  public getEditorViewType(): EditorViewType {
    return 'incoming';
  }

  public updateDecorations(): void {
    const [range] = [this.documentMapping.getModifiedRange()];
    this.decorations.setRetainDecoration(this.getRetainDecoration()).updateDecorations(range, []);
  }

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.inputComputeResultRangeMapping(changes);

    const [ranges, innerRanges] = [flatModified(changes), flatInnerModified(changes)];
    this.renderDecorations(ranges, innerRanges);

    this.registerActionsProvider({
      provideActionsItems: () => {
        const decorationOptions = {
          description: 'incoming editor view conflict actions',
          glyphMarginClassName: CONFLICT_ACTIONS_ICON.CLOSE + ' offset-right',
          firstLineDecorationClassName: CONFLICT_ACTIONS_ICON.LEFT,
        };
        return ranges.map((range) => ({ range, decorationOptions }));
      },
      onActionsClick: this.onActionsClick,
    });
  }
}
