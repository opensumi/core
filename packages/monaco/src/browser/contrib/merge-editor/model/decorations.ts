import { Injectable, Autowired, Optional } from '@opensumi/di';
import { MonacoOverrideServiceRegistry, ServiceNames } from '@opensumi/ide-core-browser';
import { uuid } from '@opensumi/ide-core-common';
import { MonacoCodeService } from '@opensumi/ide-editor/lib/browser/editor.override';
import { ZoneWidget } from '@opensumi/ide-monaco-enhance';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';

import { monaco } from '../../../monaco-api';
import { ICodeEditor, IModelDeltaDecoration } from '../../../monaco-api/editor';

import { GuidelineWidget } from './line';

interface IDiffDecoration {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
}

@Injectable({ multiple: true })
export class MergeEditorDecorations {
  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServicesRegistry: MonacoOverrideServiceRegistry;

  private readonly decorationId = `merge-editor-${uuid()}`;
  private codeEditorService: MonacoCodeService;

  private deltaDecoration: IDiffDecoration[] = [];
  private underLineWidgetSet: Set<GuidelineWidget> = new Set();

  constructor(@Optional() private readonly editor: ICodeEditor) {
    this.codeEditorService = this.overrideServicesRegistry.getRegisteredService(
      ServiceNames.CODE_EDITOR_SERVICE,
    ) as MonacoCodeService;
  }

  private setDecorations(ranges: LineRange[], innerChanges: Range[]): void {
    if (ranges.length === 0 && innerChanges.length === 0) {
      this.clearDecorations();
      return;
    }

    this.editor.changeDecorations((accessor) => {
      const newDecorations: IDiffDecoration[] = this.deltaDecoration;

      for (const range of ranges) {
        if (range.isEmpty) {
          const guidelineWidget = new GuidelineWidget(this.editor);
          guidelineWidget.create();
          guidelineWidget.showByLine(Math.max(0, range.startLineNumber - 1));

          this.underLineWidgetSet.add(guidelineWidget);
        } else {
          newDecorations.push({
            id: '',
            editorDecoration: {
              range: {
                startLineNumber: range.startLineNumber,
                startColumn: 0,
                endLineNumber: range.endLineNumberExclusive - 1,
                endColumn: Number.MAX_SAFE_INTEGER,
              },
              options: {
                description: '',
                className: 'sumi-debug-top-stack-frame-line',
                zIndex: 10,
                isWholeLine: true,
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                collapseOnReplaceEdit: true,
              },
            },
          });
        }
      }

      accessor
        .deltaDecorations(
          this.deltaDecoration.map((d) => d.id),
          newDecorations.map((d) => d.editorDecoration),
        )
        .forEach((id, i) => (newDecorations[i].id = id));
      this.deltaDecoration = newDecorations;
    });
  }

  private clearDecorations(): void {
    if (!this.deltaDecoration.length) {
      return;
    }

    this.editor.changeDecorations((accessor) => {
      for (const decoration of this.deltaDecoration) {
        accessor.removeDecoration(decoration.id);
      }

      this.deltaDecoration = [];
    });
  }

  public render(ranges: LineRange[], innerChanges: Range[]): void {
    this.setDecorations(ranges, innerChanges);
  }
}
