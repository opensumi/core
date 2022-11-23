import { Injectable } from '@opensumi/di';
import { LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { CONFLICT_ACTIONS_ICON, EditorViewType } from '../../types';
import { flatInnerModified, flatModified } from '../../utils';
import { GuidelineWidget } from '../guideline-widget';

import { BaseCodeEditor } from './baseCodeEditor';

@Injectable({ multiple: false })
export class IncomingCodeEditor extends BaseCodeEditor {
  public computeResultRangeMapping: LineRangeMapping[] = [];

  protected getMonacoEditorOptions(): IStandaloneEditorConstructionOptions {
    return { readOnly: true, lineDecorationsWidth: 42 };
  }

  protected getRetainDecoration(): IDiffDecoration[] {
    return [];
  }

  protected getRetainLineWidget(): GuidelineWidget[] {
    return [];
  }

  public getMonacoDecorationOptions(
    preDecorations: IModelDecorationOptions,
  ): Omit<IModelDecorationOptions, 'description'> {
    return {
      linesDecorationsClassName: preDecorations.className,
    };
  }

  public getEditorViewType(): EditorViewType {
    return 'incoming';
  }

  public inputDiffComputingResult(changes: LineRangeMapping[]): void {
    this.computeResultRangeMapping = changes;

    const [ranges, innerRanges] = [flatModified(changes), flatInnerModified(changes)];
    this.renderDecorations(ranges, innerRanges);

    this.registerActionsProvider({
      provideActionsItems: () => {
        const decorationOptions = {
          description: 'incoming editor view conflict actions',
          glyphMarginClassName: CONFLICT_ACTIONS_ICON.CLOSE + ' offset-right',
          firstLineDecorationClassName: CONFLICT_ACTIONS_ICON.LEFT,
        };
        return ranges.map((range) => ({ range, decorationOptions }));
      },
    });
  }
}
