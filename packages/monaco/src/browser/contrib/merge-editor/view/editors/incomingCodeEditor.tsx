import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange, LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import {
  IDiffDecoration,
  IRenderChangesInput,
  IRenderInnerChangesInput,
  MergeEditorDecorations,
} from '../../model/decorations';
import { GuidelineWidget } from '../../model/line';
import { flatInnerModified, flatModified, flatOriginal, flatInnerOriginal } from '../../utils';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class IncomingCodeEditor extends BaseCodeEditor {
  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return {};
  }

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

  protected getRetainDecoration(): IDiffDecoration[] {
    return [];
  }

  protected getRetainLineWidget(): GuidelineWidget[] {
    return [];
  }

  public override mount(): void {
    super.mount();

    const marginWith = this.editor.getLayoutInfo().contentLeft;

    this.addDispose(
      this.decorations.onDidChangeDecorations((decorations: MergeEditorDecorations) => {
        const widgets = decorations.getLineWidgets();
        if (widgets.length > 0) {
          widgets.forEach((w) => {
            if (w) {
              w.setContainerStyle({
                left: marginWith + 'px',
              });
            }
          });
        }
      }),
    );
  }

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.rangeMapping = changes;

    const [c, i] = [flatModified(changes), flatInnerModified(changes)];
    this.renderDecorations(c, i);
    this.rangeMapping = [];
  }
}
