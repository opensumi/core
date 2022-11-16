import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange, LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';

import {
  IDiffDecoration,
  IRenderChangesInput,
  IRenderInnerChangesInput,
  MergeEditorDecorations,
} from '../../model/decorations';
import { flatInnerModified, flatModified, flatOriginal, flatInnerOriginal } from '../../utils';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class ResultCodeEditor extends BaseCodeEditor {
  private rangeMapping: LineRangeMapping[] = [];
  private currentBaseRange: 0 | 1;

  protected prepareRenderDecorations(
    ranges: LineRange[],
    innerChanges: Range[],
  ): [IRenderChangesInput[], IRenderInnerChangesInput[]] {
    let otherRanges: LineRange[] = [];
    let innerOtherRanges: Range[] = [];

    if (this.currentBaseRange === 1) {
      [otherRanges, innerOtherRanges] = [flatOriginal(this.rangeMapping), flatInnerOriginal(this.rangeMapping)];
    } else if (this.currentBaseRange === 0) {
      [otherRanges, innerOtherRanges] = [flatModified(this.rangeMapping), flatInnerModified(this.rangeMapping)];
    }

    const length = ranges.length;

    const changesResult: IRenderChangesInput[] = [];
    const innerChangesResult: IRenderInnerChangesInput[] = [];

    for (let i = 0; i < length; i++) {
      if (!ranges[i].isEmpty && otherRanges[i].isEmpty) {
        changesResult.push({
          ranges: ranges[i],
          type: 'remove',
        });
      } else if (ranges[i].isEmpty && !otherRanges[i].isEmpty) {
        changesResult.push({
          ranges: ranges[i],
          type: 'insert',
        });
      } else {
        changesResult.push({
          ranges: ranges[i],
          type: 'modify',
        });
      }
    }

    return [changesResult, innerChangesResult];
  }

  protected getDeltaDecorations(): IDiffDecoration[] {
    return [];
  }

  public inputDiffComputingResult(changes: LineRangeMapping[], baseRange: 0 | 1): void {
    this.rangeMapping = changes;
    this.currentBaseRange = baseRange;

    if (baseRange === 1) {
      const [c, i] = [flatModified(changes), flatInnerModified(changes)];
      this.renderDecorations(c, i);
    } else if (baseRange === 0) {
      const [c, i] = [flatOriginal(changes), flatInnerOriginal(changes)];
      this.renderDecorations(c, i);
    }

    this.rangeMapping = [];
  }
}
