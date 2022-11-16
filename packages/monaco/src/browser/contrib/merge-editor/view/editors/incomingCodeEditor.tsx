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
export class IncomingCodeEditor extends BaseCodeEditor {
  private rangeMapping: LineRangeMapping[] = [];

  protected prepareRenderDecorations(
    ranges: LineRange[],
    innerChanges: Range[],
  ): [IRenderChangesInput[], IRenderInnerChangesInput[]] {
    const [originalRanges, innerOriginalRanges] = [
      flatOriginal(this.rangeMapping),
      flatInnerOriginal(this.rangeMapping),
    ];
    const length = ranges.length;

    const changesResult: IRenderChangesInput[] = [];
    const innerChangesResult: IRenderInnerChangesInput[] = [];

    for (let i = 0; i < length; i++) {
      if (ranges[i].isEmpty && !originalRanges[i].isEmpty) {
        changesResult.push({
          ranges: ranges[i],
          type: 'remove',
        });
      } else if (!ranges[i].isEmpty && originalRanges[i].isEmpty) {
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

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.rangeMapping = changes;

    const [c, i] = [flatModified(changes), flatInnerModified(changes)];
    this.renderDecorations(c, i);
    this.rangeMapping = [];
  }
}
