import { Injectable } from '@opensumi/di';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { DocumentMapping } from '../../model/document-mapping';
import { InnerRange } from '../../model/inner-range';
import { LineRange } from '../../model/line-range';
import { LineRangeMapping } from '../../model/line-range-mapping';
import { EDiffRangeTurn, EditorViewType } from '../../types';
import { flatInnerModified, flatModified, flatOriginal, flatInnerOriginal } from '../../utils';
import { GuidelineWidget } from '../guideline-widget';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class ResultCodeEditor extends BaseCodeEditor {
  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { lineNumbersMinChars: 2, lineDecorationsWidth: 24 };
  }

  private currentBaseRange: 0 | 1;

  /** @deprecated */
  public documentMapping: DocumentMapping;

  public documentMappingTurnLeft: DocumentMapping;
  public documentMappingTurnRight: DocumentMapping;

  public override mount(): void {
    super.mount();

    this.documentMappingTurnLeft = this.injector.get(DocumentMapping, [this, EDiffRangeTurn.ORIGIN]);
    this.documentMappingTurnRight = this.injector.get(DocumentMapping, [this, EDiffRangeTurn.MODIFIED]);
  }

  protected override prepareRenderDecorations(
    ranges: LineRange[],
    innerChanges: InnerRange[][],
  ): [LineRange[], InnerRange[][]] {
    const toBeRanges: LineRange[] =
      this.currentBaseRange === 1
        ? this.documentMappingTurnLeft.getOriginalRange()
        : this.documentMappingTurnRight.getModifiedRange();

    const changesResult: LineRange[] = [];
    const innerChangesResult: InnerRange[][] = [];

    ranges.forEach((range, idx) => {
      const sameInner = innerChanges[idx];
      if (range.isTendencyLeft(toBeRanges[idx])) {
        changesResult.push(range.setType('remove'));
        innerChangesResult.push(sameInner.map((i) => i.setType('remove')));
      } else if (range.isTendencyRight(toBeRanges[idx])) {
        changesResult.push(range.setType('insert'));
        innerChangesResult.push(sameInner.map((i) => i.setType('insert')));
      } else {
        changesResult.push(range.setType('modify'));
        innerChangesResult.push(sameInner.map((i) => i.setType('modify')));
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

  public getMonacoDecorationOptions(
    preDecorations: IModelDecorationOptions,
  ): Omit<IModelDecorationOptions, 'description'> {
    return {
      linesDecorationsClassName: preDecorations.className,
    };
  }

  public getEditorViewType(): EditorViewType {
    return 'result';
  }

  public updateDecorations(): void {
    throw new Error('Method not implemented.');
  }

  public inputDiffComputingResult(changes: LineRangeMapping[], baseRange: 0 | 1): void {
    this.currentBaseRange = baseRange;

    if (baseRange === 1) {
      this.documentMappingTurnLeft.inputComputeResultRangeMapping(changes);
      const [c, i] = [flatModified(changes), flatInnerModified(changes)];
      this.renderDecorations(c, i);
    } else if (baseRange === 0) {
      this.documentMappingTurnRight.inputComputeResultRangeMapping(changes);
      const [c, i] = [flatOriginal(changes), flatInnerOriginal(changes)];
      this.renderDecorations(c, i);
    }
  }
}
