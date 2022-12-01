import { Injectable } from '@opensumi/di';
import { IEditorMouseEvent } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { DocumentMapping } from '../../model/document-mapping';
import { LineRangeMapping } from '../../model/line-range-mapping';
import { ACCEPT_CURRENT, CONFLICT_ACTIONS_ICON, EditorViewType, IGNORE, DECORATIONS_CLASSNAME } from '../../types';
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

  private onActionsClick(e: IEditorMouseEvent): boolean {
    const element = e.target.element!;
    const position = e.target.position;

    if (!position) {
      return false;
    }

    const action = this.conflictActions.getActions(position.lineNumber);
    if (!action) {
      return false;
    }

    const { range } = action;

    if (element.classList.contains(ACCEPT_CURRENT)) {
      this._onDidConflictActions.fire({ range, withViewType: EditorViewType.INCOMING, action: ACCEPT_CURRENT });
    } else if (element.classList.contains(IGNORE)) {
      this._onDidConflictActions.fire({ range, withViewType: EditorViewType.INCOMING, action: IGNORE });
    }

    return true;
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
      provideActionsItems: () => {
        const decorationOptions = {
          glyphMarginClassName: CONFLICT_ACTIONS_ICON.CLOSE + ' offset-right',
          firstLineDecorationClassName: CONFLICT_ACTIONS_ICON.LEFT,
        };
        return ranges.map((range) => ({ range, decorationOptions }));
      },
      onActionsClick: this.onActionsClick,
    });
  }
}
