import { Injectable } from '@opensumi/di';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration, IRenderChangesInput, IRenderInnerChangesInput } from '../../model/decorations';
import { GuidelineWidget } from '../../model/line';
import { LineRange } from '../../model/line-range';
import { flatInnerOriginal, flatModified, flatOriginal } from '../../utils';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class CurrentCodeEditor extends BaseCodeEditor {
  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { readOnly: true };
  }

  protected computeResultRangeMapping: LineRangeMapping[] = [];

  protected getRetainDecoration(): IDiffDecoration[] {
    return [];
  }

  protected getRetainLineWidget(): GuidelineWidget[] {
    return [];
  }

  protected override prepareRenderDecorations(ranges: LineRange[], innerChanges: Range[][]) {
    return super.prepareRenderDecorations(ranges, innerChanges, 1);
  }

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.computeResultRangeMapping = changes;

    const [c, i] = [flatOriginal(changes), flatInnerOriginal(changes)];

    this.renderDecorations(c, i);
    this.computeResultRangeMapping = [];
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
