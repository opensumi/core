import { Disposable } from '@opensumi/ide-core-common';
import { ICodeEditor, IModelDecorationsChangeAccessor, IModelDeltaDecoration } from '@opensumi/ide-monaco';

interface IEnhanceModelDeltaDecoration {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
  dispose(): void;
}

export class EnhanceDecorationsCollection extends Disposable {
  private deltaDecorations: IEnhanceModelDeltaDecoration[] = [];

  constructor(private readonly codeEditor: ICodeEditor) {
    super();

    this.addDispose(
      Disposable.create(() => {
        this.clear();
      }),
    );
  }

  private delete(id: string): void {
    this.codeEditor.changeDecorations((accessor) => {
      accessor.removeDecoration(id);

      this.deltaDecorations = this.deltaDecorations.filter((d) => d.id !== id);
    });
  }

  set(decorations: IModelDeltaDecoration[]): void {
    this.clear();

    this.codeEditor.changeDecorations((accessor: IModelDecorationsChangeAccessor) => {
      const newDecorations: IEnhanceModelDeltaDecoration[] = [];

      for (const decoration of decorations) {
        const id = accessor.addDecoration(decoration.range, decoration.options);

        newDecorations.push({
          id,
          editorDecoration: decoration,
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

  clear(): void {
    this.codeEditor.changeDecorations((accessor) => {
      for (const decoration of this.deltaDecorations) {
        accessor.removeDecoration(decoration.id);
      }

      this.deltaDecorations = [];
    });
  }
}
