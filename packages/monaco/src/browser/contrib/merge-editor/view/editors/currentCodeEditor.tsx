import { Injectable } from '@opensumi/di';
import { Margin } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/viewParts/margin/margin';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { LineRange } from '../../model/line-range';
import { EditorViewType } from '../../types';
import { flatInnerOriginal, flatOriginal } from '../../utils';
import { GuidelineWidget } from '../guideline-widget';

import { BaseCodeEditor } from './baseCodeEditor';


@Injectable({ multiple: false })
export class CurrentCodeEditor extends BaseCodeEditor {
  public computeResultRangeMapping: LineRangeMapping[] = [];

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { readOnly: true };
  }

  protected getRetainDecoration(): IDiffDecoration[] {
    return [];
  }

  protected getRetainLineWidget(): GuidelineWidget[] {
    return [];
  }

  protected override prepareRenderDecorations(ranges: LineRange[], innerChanges: Range[][]) {
    return super.prepareRenderDecorations(ranges, innerChanges, 1);
  }

  public getMonacoDecorationOptions(
    preDecorations: IModelDecorationOptions,
  ): Omit<IModelDecorationOptions, 'description'> {
    return {
      marginClassName: preDecorations.className,
    };
  }

  public getEditorViewType(): EditorViewType {
    return 'current';
  }

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.computeResultRangeMapping = changes;

    const [c, i] = [flatOriginal(changes), flatInnerOriginal(changes)];

    this.renderDecorations(c, i);

    this.layout();
  }

  /**
   * current view 视图需要把 margin 区域放在右边
   */
  public layout(): void {
    const editor = this.getEditor();
    const dom = editor.getDomNode();
    if (dom) {
      /**
       * ICodeEditor 内部没有导出 margin part 相关的对象，这里通过 dom 获取节点
       */
      const marginDom: HTMLElement | null = dom.querySelector('.' + Margin.OUTER_CLASS_NAME);
      /**
       * 获取代码编辑区域的 dom 节点
       * 因为他是被包裹在 EditorScrollbar 这个 view part 内的，所以直接获取该 scrollbar 的 dom
       * 参考: https://github.com/microsoft/vscode/blob/main/src/vs/editor/browser/view.ts#L132
       */
      const codeDom: HTMLElement | null = (editor as any)?._modelData.hasRealView
        ? (editor as any)?._modelData.view._scrollbar.scrollbarDomNode.domNode
        : null;

      if (marginDom && codeDom) {
        marginDom.style.right = '0px';
        codeDom.style.left = '0px';
      }
    }
  }
}
