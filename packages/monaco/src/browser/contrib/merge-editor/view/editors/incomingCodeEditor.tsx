import { Injectable } from '@opensumi/di';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { DocumentMapping } from '../../model/document-mapping';
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
import { flatInnerModified, flatModified } from '../../utils';
import { GuidelineWidget } from '../guideline-widget';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class IncomingCodeEditor extends BaseCodeEditor {
  public get documentMapping(): DocumentMapping {
    return this.mappingManagerService.documentMappingTurnRight;
  }

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { readOnly: true, lineDecorationsWidth: 42 };
  }

  protected getRetainDecoration(): IDiffDecoration[] {
    return [];
  }

  protected getRetainLineWidget(): GuidelineWidget[] {
    return [];
  }

  private provideActionsItems(): IActionsDescription[] {
    const ranges = this.documentMapping.getModifiedRange();
    return ranges.map((range) => {
      const idMark = `${ADDRESSING_TAG_CLASSNAME}${range.id}`;
      return {
        range,
        decorationOptions: {
          glyphMarginClassName: DECORATIONS_CLASSNAME.combine(
            CONFLICT_ACTIONS_ICON.CLOSE,
            DECORATIONS_CLASSNAME.offset_right,
            idMark,
          ),
          firstLineDecorationClassName: DECORATIONS_CLASSNAME.combine(CONFLICT_ACTIONS_ICON.LEFT, idMark),
        },
      };
    });
  }

  private onActionsClick(rangeId: string, actionType: TActionsType): void {
    const action = this.conflictActions.getAction(rangeId);
    if (!action) {
      return;
    }

    const { range } = action;

    if (actionType === ACCEPT_CURRENT_ACTIONS) {
      this._onDidConflictActions.fire({ range, withViewType: EditorViewType.INCOMING, action: ACCEPT_CURRENT_ACTIONS });
    } else if (actionType === IGNORE_ACTIONS) {
      this._onDidConflictActions.fire({ range, withViewType: EditorViewType.INCOMING, action: IGNORE_ACTIONS });
    }
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

  public updateDecorations(): void {
    const [range] = [this.documentMapping.getModifiedRange()];
    this.decorations
      .setRetainDecoration(this.getRetainDecoration())
      .setRetainLineWidget(this.getRetainLineWidget())
      .updateDecorations(range, []);
  }

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.mappingManagerService.inputComputeResultRangeMappingTurnRight(changes);

    const [ranges, innerRanges] = [flatModified(changes), flatInnerModified(changes)];
    this.renderDecorations(ranges, innerRanges);

    this.registerActionsProvider({
      provideActionsItems: this.provideActionsItems,
      onActionsClick: this.onActionsClick,
    });
  }
}
