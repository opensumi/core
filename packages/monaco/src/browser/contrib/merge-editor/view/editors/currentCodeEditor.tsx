import { Injectable } from '@opensumi/di';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange, LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration, IRenderChangesInput, IRenderInnerChangesInput } from '../../model/decorations';
import { GuidelineWidget } from '../../model/line';
import { flatInnerModified, flatInnerOriginal, flatModified, flatOriginal } from '../../utils';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class CurrentCodeEditor extends BaseCodeEditor {
  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { readOnly: true };
  }

  private rangeMapping: LineRangeMapping[] = [];

  protected prepareRenderDecorations(
    ranges: LineRange[],
    innerChanges: Range[][],
  ): [IRenderChangesInput[], IRenderInnerChangesInput[]] {
    const modifiedRanges = flatModified(this.rangeMapping);
    const length = ranges.length;

    const changesResult: IRenderChangesInput[] = [];
    const innerChangesResult: IRenderInnerChangesInput[] = [];

    for (let i = 0; i < length; i++) {
      if (ranges[i].isEmpty && !modifiedRanges[i].isEmpty) {
        changesResult.push({
          ranges: ranges[i],
          type: 'remove',
        });
        innerChangesResult.push({
          ranges: innerChanges[i],
          type: 'remove',
        });
      } else if (!ranges[i].isEmpty && modifiedRanges[i].isEmpty) {
        changesResult.push({
          ranges: ranges[i],
          type: 'insert',
        });
        innerChangesResult.push({
          ranges: innerChanges[i],
          type: 'insert',
        });
      } else {
        changesResult.push({
          ranges: ranges[i],
          type: 'modify',
        });
        innerChangesResult.push({
          ranges: innerChanges[i],
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

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.rangeMapping = changes;

    const [c, i] = [flatOriginal(changes), flatInnerOriginal(changes)];

    this.renderDecorations(c, i);
    this.rangeMapping = [];
  }

  public layout(): void {
    const dom = this.getEditor().getDomNode();
    if (dom) {
      const marginDom = dom.querySelector('.margin');
      const elementDom = dom.querySelector('.monaco-scrollable-element');

      if (marginDom) {
        marginDom.setAttribute('style', `${marginDom.getAttribute('style')} right: 0px;`);
      }

      if (elementDom) {
        elementDom.setAttribute('style', `${elementDom.getAttribute('style')} left: 0px;`);
      }
    }
  }
}
