import { Injectable } from '@opensumi/di';
import { IEditorMouseEvent, MouseTargetType } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { Margin } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/viewParts/margin/margin';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { DocumentMapping } from '../../model/document-mapping';
import { LineRange } from '../../model/line-range';
import { LineRangeMapping } from '../../model/line-range-mapping';
import {
  ACCEPT_CURRENT_ACTIONS,
  CONFLICT_ACTIONS_ICON,
  EditorViewType,
  IGNORE_ACTIONS,
  DECORATIONS_CLASSNAME,
  ADDRESSING_TAG_CLASSNAME,
  TActionsType,
  IActionsDescription,
  APPEND_ACTIONS,
  IConflictActionsEvent,
} from '../../types';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class CurrentCodeEditor extends BaseCodeEditor {
  public get documentMapping(): DocumentMapping {
    return this.mappingManagerService.documentMappingTurnLeft;
  }

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { readOnly: true, lineNumbersMinChars: 5 };
  }

  protected override prepareRenderDecorations() {
    return super.prepareRenderDecorations(1);
  }

  protected provideActionsItems(): IActionsDescription[] {
    const ranges = this.documentMapping.getOriginalRange();
    return ranges
      .filter((r) => !r.isComplete)
      .map((range) => {
        const idMark = `${ADDRESSING_TAG_CLASSNAME}${range.id}`;
        let iconActions = CONFLICT_ACTIONS_ICON.RIGHT;

        if (range.isMerge) {
          const oppositeRange = this.documentMapping.adjacentComputeRangeMap.get(range.id);
          if (oppositeRange && oppositeRange.isComplete) {
            iconActions = CONFLICT_ACTIONS_ICON.ROTATE_RIGHT;
          }
        }

        return {
          range,
          decorationOptions: {
            glyphMarginClassName: DECORATIONS_CLASSNAME.combine(iconActions, DECORATIONS_CLASSNAME.offset_left, idMark),
            marginClassName: DECORATIONS_CLASSNAME.combine(CONFLICT_ACTIONS_ICON.CLOSE, idMark),
          },
        };
      });
  }

  public getMonacoDecorationOptions(
    preDecorations: IModelDecorationOptions,
    range: LineRange,
  ): Omit<IModelDecorationOptions, 'description'> {
    return {
      marginClassName: DECORATIONS_CLASSNAME.combine(
        DECORATIONS_CLASSNAME.margin_className,
        DECORATIONS_CLASSNAME.range_type[range.type],
        DECORATIONS_CLASSNAME.stretch_right,
        DECORATIONS_CLASSNAME.stretch_left,
      ),
      className: DECORATIONS_CLASSNAME.combine(preDecorations.className || '', DECORATIONS_CLASSNAME.stretch_right),
    };
  }

  public getEditorViewType(): EditorViewType {
    return EditorViewType.CURRENT;
  }

  public override launchConflictActionsEvent(eventData: Omit<IConflictActionsEvent, 'withViewType'>): void {
    const { range, action } = eventData;
    super.launchConflictActionsEvent({
      range,
      action,
      withViewType: EditorViewType.CURRENT,
    });
  }

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.mappingManagerService.inputComputeResultRangeMappingTurnLeft(changes);
    this.updateDecorations();
    this.registerActionsProvider({
      provideActionsItems: this.provideActionsItems,
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
      onActionsClick: (range: LineRange, actionType: TActionsType) => {
        if (actionType === ACCEPT_CURRENT_ACTIONS) {
          this.launchConflictActionsEvent({
            range,
            action: ACCEPT_CURRENT_ACTIONS,
          });
        }

        if (actionType === IGNORE_ACTIONS) {
          this.launchConflictActionsEvent({
            range,
            action: IGNORE_ACTIONS,
          });
        }

        if (actionType === APPEND_ACTIONS) {
          this.launchConflictActionsEvent({
            range,
            action: APPEND_ACTIONS,
          });
        }
      },
    });

    requestAnimationFrame(() => {
      this.layout();
    });
  }

  /**
   *  current view 视图需要把 margin 区域放在右边
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
