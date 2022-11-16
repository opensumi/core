import { Injector } from '@opensumi/di';
import { MonacoService } from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-common';
import { ICodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { LineRange, LineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/linesDiffComputer';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

import {
  IDiffDecoration,
  IRenderChangesInput,
  IRenderInnerChangesInput,
  MergeEditorDecorations,
} from '../../model/decorations';

export abstract class BaseCodeEditor extends Disposable {
  protected decorations: MergeEditorDecorations;
  protected editor: ICodeEditor;

  constructor(
    private readonly container: HTMLDivElement,
    private readonly monacoService: MonacoService,
    private readonly injector: Injector,
  ) {
    super();
    this.mount();
  }

  public mount(): void {
    this.editor = this.monacoService.createCodeEditor(this.container, {
      automaticLayout: true,
      wordBasedSuggestions: true,
      renderLineHighlight: 'all',
      folding: false,
      lineNumbersMinChars: 2,
      minimap: {
        enabled: false,
      },
    });

    this.decorations = this.injector.get(MergeEditorDecorations, [this.editor]);
  }

  public getEditor(): ICodeEditor {
    return this.editor;
  }

  public getModel(): ITextModel | null {
    return this.editor.getModel();
  }

  protected abstract getDeltaDecorations(): IDiffDecoration[];

  /**
   * 在绘制前，计算当前 range 和 innerChanges 是什么类型，如 insert、modify 亦或是 remove
   */
  protected abstract prepareRenderDecorations(
    ranges: LineRange[],
    innerChanges: Range[],
  ): [IRenderChangesInput[], IRenderInnerChangesInput[]];

  protected renderDecorations(ranges: LineRange[], innerChanges: Range[]): void {
    const [r, i] = this.prepareRenderDecorations(ranges, innerChanges);
    this.decorations.render(r, i);
  }

  /**
   * @param diffByDirection
   * 0 表示自己以 originalRange 为基础，与 modifiedRange 作比较
   * 1 与 0 相反
   */
  public abstract inputDiffComputingResult(changes: LineRangeMapping[], baseRange?: 0 | 1): void;
}
