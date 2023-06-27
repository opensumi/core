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
  APPEND_ACTIONS,
  IConflictActionsEvent,
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
        let iconActions = CONFLICT_ACTIONS_ICON.LEFT;

        if (range.isMerge) {
          const oppositeRange = this.documentMapping.adjacentComputeRangeMap.get(range.id);
          if (oppositeRange && oppositeRange.isComplete) {
            iconActions = CONFLICT_ACTIONS_ICON.ROTATE_LEFT;
          }
        }

        return {
          range,
          decorationOptions: {
            glyphMarginClassName: DECORATIONS_CLASSNAME.combine(
              CONFLICT_ACTIONS_ICON.CLOSE,
              DECORATIONS_CLASSNAME.offset_right,
              idMark,
            ),
            firstLineDecorationClassName: DECORATIONS_CLASSNAME.combine(iconActions, idMark),
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

  public override launchConflictActionsEvent(eventData: Omit<IConflictActionsEvent, 'withViewType'>): void {
    const { range, action } = eventData;
    this._onDidConflictActions.fire({
      range,
      action,
      withViewType: EditorViewType.INCOMING,
    });
  }

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.mappingManagerService.inputComputeResultRangeMappingTurnRight(changes);
    this.updateDecorations();
    this.registerActionsProvider({
      provideActionsItems: this.provideActionsItems,
      onActionsClick: (range: LineRange, actionType: TActionsType) => {
        if (actionType === ACCEPT_CURRENT_ACTIONS) {
          this.launchConflictActionsEvent({
            range,
            action: ACCEPT_CURRENT_ACTIONS,
          });
        }

        if (actionType === IGNORE_ACTIONS) {
          this.launchConflictActionsEvent({ range, action: IGNORE_ACTIONS });
        }

        if (actionType === APPEND_ACTIONS) {
          this.launchConflictActionsEvent({ range, action: APPEND_ACTIONS });
        }
      },
    });
  }
}
