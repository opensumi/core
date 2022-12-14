import { Injectable } from '@opensumi/di';
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
} from '../../types';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class IncomingCodeEditor extends BaseCodeEditor {
  public get documentMapping(): DocumentMapping {
    return this.mappingManagerService.documentMappingTurnRight;
  }

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { readOnly: true, lineDecorationsWidth: 42 };
  }

  protected provideActionsItems(): IActionsDescription[] {
    const ranges = this.documentMapping.getModifiedRange();
    return ranges
      .filter((r) => !r.isComplete)
      .map((range) => {
        const idMark = `${ADDRESSING_TAG_CLASSNAME}${range.id}`;
        let rotataClassName = '';
        if (range.isMerge) {
          const sameRange = this.documentMapping.adjacentComputeRangeMap.get(range.id);
          if (sameRange && sameRange.isComplete) {
            rotataClassName = DECORATIONS_CLASSNAME.rotate_turn_right;
          }
        }

        return {
          range,
          decorationOptions: {
            glyphMarginClassName: DECORATIONS_CLASSNAME.combine(
              CONFLICT_ACTIONS_ICON.CLOSE,
              DECORATIONS_CLASSNAME.offset_right,
              rotataClassName,
              idMark,
            ),
            firstLineDecorationClassName: DECORATIONS_CLASSNAME.combine(CONFLICT_ACTIONS_ICON.LEFT, idMark),
          },
        };
      });
  }

  public getMonacoDecorationOptions(
    preDecorations: IModelDecorationOptions,
  ): Omit<IModelDecorationOptions, 'description'> {
    return {
      linesDecorationsClassName: DECORATIONS_CLASSNAME.combine(
        DECORATIONS_CLASSNAME.stretch_right,
        DECORATIONS_CLASSNAME.stretch_left,
        preDecorations.className || '',
      ),
      className: DECORATIONS_CLASSNAME.combine(DECORATIONS_CLASSNAME.stretch_left, preDecorations.className || ''),
    };
  }

  public getEditorViewType(): EditorViewType {
    return EditorViewType.INCOMING;
  }

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.mappingManagerService.inputComputeResultRangeMappingTurnRight(changes);
    this.updateDecorations();
    this.registerActionsProvider({
      provideActionsItems: this.provideActionsItems,
      onActionsClick: (range: LineRange, actionType: TActionsType) => {
        if (actionType === ACCEPT_CURRENT_ACTIONS) {
          this._onDidConflictActions.fire({
            range,
            withViewType: EditorViewType.INCOMING,
            action: ACCEPT_CURRENT_ACTIONS,
          });
        } else if (actionType === IGNORE_ACTIONS) {
          this._onDidConflictActions.fire({ range, withViewType: EditorViewType.INCOMING, action: IGNORE_ACTIONS });
        }
      },
    });
  }
}
