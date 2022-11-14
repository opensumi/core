import { Injectable, Autowired, INJECTOR_TOKEN, Injector, Optional } from '@opensumi/di';
import { MonacoOverrideServiceRegistry, ServiceNames } from '@opensumi/ide-core-browser';
import { uuid } from '@opensumi/ide-core-common';
import { MonacoCodeService } from '@opensumi/ide-editor/lib/browser/editor.override';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange, LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';

import { monaco } from '../../../monaco-api';
import { ICodeEditor, IModelDecorationOptions, IModelDeltaDecoration } from '../../../monaco-api/editor';
import { IDisposable } from '../../../monaco-api/types';

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
      const newDecorations: IDiffDecoration[] = [];

      for (const range of ranges) {
        newDecorations.push({
          id: '',
          editorDecoration: {
            range: {
              startLineNumber: range.startLineNumber,
              startColumn: 0,
              endLineNumber: Math.max(range.startLineNumber, range.endLineNumberExclusive - 1),
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
