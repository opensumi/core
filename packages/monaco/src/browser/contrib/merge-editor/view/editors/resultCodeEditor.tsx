import { Injectable } from '@opensumi/di';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import {
  IDiffDecoration,
  IRenderChangesInput,
  IRenderInnerChangesInput,
} from '../../model/decorations';

import { LineRange } from '../../model/line-range';
import { EditorViewType } from '../../types';
import { flatInnerModified, flatModified, flatOriginal, flatInnerOriginal } from '../../utils';
import { GuidelineWidget } from '../guideline-widget';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class ResultCodeEditor extends BaseCodeEditor {
  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return {};
  }

  private currentBaseRange: 0 | 1;
  public computeResultRangeMapping: LineRangeMapping[] = [];

  protected override prepareRenderDecorations(
    ranges: LineRange[],
    innerChanges: Range[][],
  ): [IRenderChangesInput[], IRenderInnerChangesInput[]] {
    const toBeRanges: LineRange[] =
      this.currentBaseRange === 1
        ? flatOriginal(this.computeResultRangeMapping)
        : flatModified(this.computeResultRangeMapping);

    const changesResult: IRenderChangesInput[] = [];
    const innerChangesResult: IRenderInnerChangesInput[] = [];

    ranges.forEach((range, idx) => {
      const sameInner = innerChanges[idx];
      if (range.isTendencyLeft(toBeRanges[idx])) {
        changesResult.push({ ranges: range, type: 'remove' });
        innerChangesResult.push({ ranges: sameInner, type: 'remove' });
      } else if (range.isTendencyRight(toBeRanges[idx])) {
        changesResult.push({ ranges: range, type: 'insert' });
        innerChangesResult.push({ ranges: sameInner, type: 'insert' });
      } else {
        changesResult.push({ ranges: range, type: 'modify' });
        innerChangesResult.push({ ranges: sameInner, type: 'modify' });
      }
    });

    return [changesResult, innerChangesResult];
  }

  protected getRetainDecoration(): IDiffDecoration[] {
    return this.decorations.getDecorations();
  }

  protected getRetainLineWidget(): GuidelineWidget[] {
    return this.decorations.getLineWidgets();
  }

  public getEditorViewType(): EditorViewType {
    return 'result';
  }

  public inputDiffComputingResult(changes: LineRangeMapping[], baseRange: 0 | 1): void {
    this.computeResultRangeMapping = changes;
    this.currentBaseRange = baseRange;

    if (baseRange === 1) {
      const [c, i] = [flatModified(changes), flatInnerModified(changes)];
      this.renderDecorations(c, i);
    } else if (baseRange === 0) {
      const [c, i] = [flatOriginal(changes), flatInnerOriginal(changes)];
      this.renderDecorations(c, i);
    }
  }
}
