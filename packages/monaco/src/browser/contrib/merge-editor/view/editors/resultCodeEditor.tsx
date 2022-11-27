import { Injectable } from '@opensumi/di';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { DocumentMapping } from '../../model/document-mapping';
import { InnerRange } from '../../model/inner-range';
import { LineRange } from '../../model/line-range';
import { LineRangeMapping } from '../../model/line-range-mapping';
import { EDiffRangeTurn, EditorViewType, LineRangeType } from '../../types';
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
      const sameRange = toBeRanges[idx];
      const _exec = (type: LineRangeType) => {
        changesResult.push(range.setType(type));
        innerChangesResult.push(sameInner.map((i) => i.setType(type)));
        const entries = this.documentMappingTurnLeft.adjacentComputeRangeMap.entries();
        for (const [key, value] of entries) {
          if (sameRange.id === key) {
            this.documentMappingTurnLeft.adjacentComputeRangeMap.set(key, value.setType(type));
          }
        }
      };

      _exec(range.isTendencyLeft(sameRange) ? 'remove' : range.isTendencyRight(sameRange) ? 'insert' : 'modify');
    });
    return [changesResult, innerChangesResult];
  }

  protected getRetainDecoration(): IDiffDecoration[] {
    const values = this.currentBaseRange === 1 ? [] : this.documentMappingTurnLeft.getModifiedRange();
    const retain: IDiffDecoration[] = [];
    for (const range of values) {
      if (!range.isEmpty) {
        retain.push(this.decorations.createLineDecoration(range));
      }
    }
    return retain;
  }

  protected getRetainLineWidget(): GuidelineWidget[] {
    const values = this.currentBaseRange === 1 ? [] : this.documentMappingTurnLeft.getModifiedRange();
    const retain: GuidelineWidget[] = [];
    for (const range of values) {
      if (range.isEmpty) {
        retain.push(this.decorations.createGuideLineWidget(range));
      }
    }
    return retain;
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
    const toBeRanges: LineRange[] =
      this.currentBaseRange === 1
        ? this.documentMappingTurnLeft.getModifiedRange()
        : this.documentMappingTurnRight.getOriginalRange();
    this.decorations
      .setRetainDecoration(this.getRetainDecoration())
      .setRetainLineWidget(this.getRetainLineWidget())
      .updateDecorations(toBeRanges, []);
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
