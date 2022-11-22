import { Injectable, Injector } from '@opensumi/di';
import { getIcon, MonacoService } from '@opensumi/ide-core-browser';
import { LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import { IModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IStandaloneEditorConstructionOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneCodeEditor';

import { IDiffDecoration } from '../../model/decorations';
import { ACCEPT_CURRENT, EditorViewType, IGNORE } from '../../types';
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
          glyphMarginClassName: `conflict-actions offset-right ${IGNORE} ${getIcon('close')}`,
          firstLineDecorationClassName: `conflict-actions ${ACCEPT_CURRENT} ${getIcon('left')}`,
        };
        return ranges.map((range) => ({ range, decorationOptions }));
      },
    });
  }
}
