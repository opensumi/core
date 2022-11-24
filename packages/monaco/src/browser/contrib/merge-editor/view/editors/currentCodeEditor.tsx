import { Injectable } from '@opensumi/di';
import { IEditorMouseEvent, MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { Margin } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/viewParts/margin/margin';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { DocumentMapping } from '../../model/document-mapping';
import { LineRange } from '../../model/line-range';
import { LineRangeMapping } from '../../model/line-range-mapping';
import { ACCEPT_CURRENT, CONFLICT_ACTIONS_ICON, EDiffRangeTurn, EditorViewType, IGNORE } from '../../types';
import { flatInnerOriginal, flatOriginal } from '../../utils';
import { GuidelineWidget } from '../guideline-widget';

import { BaseCodeEditor } from './baseCodeEditor';
import { ResultCodeEditor } from './resultCodeEditor';

// 用来寻址点击事件时的标记
const ADDRESSING_TAG_CLASSNAME = 'ADDRESSING_TAG_CLASSNAME_';

@Injectable({ multiple: false })
export class CurrentCodeEditor extends BaseCodeEditor {
  public documentMapping: DocumentMapping;

  public override mount(): void {
    super.mount();

    this.documentMapping = this.injector.get(DocumentMapping, [this, EDiffRangeTurn.ORIGIN]);
  }

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { readOnly: true, lineNumbersMinChars: 5 };
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

  private onActionsClick(e: IEditorMouseEvent, currentView: BaseCodeEditor, resultView: ResultCodeEditor): void {
    const element = e.target.element!;

    if (element.classList.contains(ACCEPT_CURRENT)) {
      const toArry = Array.from(element.classList);
      const find = toArry.find((c) => c.startsWith(ADDRESSING_TAG_CLASSNAME));
      if (find) {
        const posiLine = Number(find.replace(ADDRESSING_TAG_CLASSNAME, ''));
        if (typeof posiLine === 'number') {
          const action = this.conflictActions.getActions(posiLine);
          if (!action) {
            return;
          }

          const { range } = action;
          const sameRange = resultView.documentMappingTurnLeft.sameComputeResultRange.get(range.id);

          const applyText = currentView.getModel()!.getValueInRange(range.toRange());

          if (sameRange) {
            this.conflictActions.applyLineRangeEdits(resultView.getModel()!, [
              {
                range: sameRange as LineRange,
                text: applyText,
              },
            ]);
            resultView.documentMappingTurnLeft.delta(sameRange as LineRange, range.length);
          }
        }
      }

      return;
    }

    if (element.classList.contains(IGNORE)) {
      // not implement
      return;
    }
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
    this.inputComputeResultRangeMapping(changes);

    const [ranges, innerRanges] = [flatOriginal(changes), flatInnerOriginal(changes)];

    this.renderDecorations(ranges, innerRanges);

    this.registerActionsProvider({
      provideActionsItems: () =>
        ranges.map((range) => {
          const posiMark = `${ADDRESSING_TAG_CLASSNAME}${range.startLineNumber}`;
          return {
            range,
            decorationOptions: {
              description: 'current editor view conflict actions',
              glyphMarginClassName: CONFLICT_ACTIONS_ICON.RIGHT + ` offset-left ${posiMark}`,
              marginClassName: CONFLICT_ACTIONS_ICON.CLOSE + ` ${posiMark}`,
            },
          };
        }),
      mouseDownGuard: (e: IEditorMouseEvent) => {
        /**
         * 注: 由于 current view 视图已经将 margin 区域和 code 区域交换了
         * 导致 editor mousedown 在处理点击事件的时候无法通过内部逻辑找到 target type 和 position 等信息
         * 进而导致没法知道点击了哪个位置上的 actions 图标
         * 所以这里通过 ADDRESSING_TAG_CLASSNAME 标志符加 lineNumber 给 className 类名的方式，来找到具体点击了哪个 actions
         */
        if (!(e.target.type === MouseTargetType.UNKNOWN) || e.event.rightButton) {
          return false;
        }

        if (!e.target.element) {
          return false;
        }

        return true;
      },
      onActionsClick: this.onActionsClick,
    });

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
