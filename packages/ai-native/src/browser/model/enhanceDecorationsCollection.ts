import { Disposable, Emitter, Event, isUndefined } from '@opensumi/ide-core-common';
import {
  ICodeEditor,
  IContentSizeChangedEvent,
  IModelDecorationsChangeAccessor,
  IModelDeltaDecoration,
  ITextModel,
} from '@opensumi/ide-monaco';

interface IEnhanceModelDeltaDecoration {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
  dispose(): void;
  length: number;
}

export class EnhanceDecorationsCollection extends Disposable {
  private deltaDecorations: IEnhanceModelDeltaDecoration[] = [];

  protected readonly _onDidDecorationsChange = new Emitter<IEnhanceModelDeltaDecoration[]>();
  public readonly onDidDecorationsChange: Event<IEnhanceModelDeltaDecoration[]> = this._onDidDecorationsChange.event;

  private get model(): ITextModel {
    return this.codeEditor.getModel()!;
  }

  constructor(private readonly codeEditor: ICodeEditor) {
    super();

    this.addDispose(
      Disposable.create(() => {
        this.clear();
      }),
    );

    this.addDispose(
      this.codeEditor.onDidContentSizeChange((event: IContentSizeChangedEvent) => {
        const { contentHeightChanged } = event;
        if (contentHeightChanged) {
          this.flush();
        }
      }),
    );
  }

  /**
   * 每次在文档变更时获取新的 decoration 位置
   */
  private flush(): void {
    this.deltaDecorations = this.deltaDecorations.map((d) => {
      const {
        id,
        editorDecoration: { range },
      } = d;

      const newRange = this.model.getDecorationRange(id);
      d.editorDecoration.range = newRange ?? range;

      return d;
    });

    this._onDidDecorationsChange.fire(this.deltaDecorations);
  }

  private delete(id: string): void {
    this.codeEditor.changeDecorations((accessor) => {
      accessor.removeDecoration(id);

      this.deltaDecorations = this.deltaDecorations.filter((d) => d.id !== id);
    });
  }

  set(decorations: (IModelDeltaDecoration & { length?: number })[]): void {
    this.clear();

    this.codeEditor.changeDecorations((accessor: IModelDecorationsChangeAccessor) => {
      const newDecorations: IEnhanceModelDeltaDecoration[] = [];

      for (const decoration of decorations) {
        const id = accessor.addDecoration(decoration.range, decoration.options);

        newDecorations.push({
          id,
          editorDecoration: decoration,
          length: isUndefined(decoration.length)
            ? decoration.range.endLineNumber - decoration.range.startLineNumber
            : decoration.length,
          dispose: () => {
            this.delete(id);
          },
        });
      }

      this.deltaDecorations = newDecorations;
    });
  }

  getDecorations(): IEnhanceModelDeltaDecoration[] {
    return this.deltaDecorations;
  }

  getDecorationByLineNumber(lineNumber: number): IEnhanceModelDeltaDecoration | undefined {
    return this.deltaDecorations.find((d) => d.editorDecoration.range.startLineNumber === lineNumber);
  }

  clear(): void {
    this.codeEditor.changeDecorations((accessor) => {
      for (const decoration of this.deltaDecorations) {
        accessor.removeDecoration(decoration.id);
      }

      this.deltaDecorations = [];
    });
  }
}
