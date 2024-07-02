import { Disposable, Emitter, Event, isUndefined } from '@opensumi/ide-core-common';
import {
  ICodeEditor,
  IContentSizeChangedEvent,
  IModelDecorationOptions,
  IModelDecorationsChangeAccessor,
  IModelDeltaDecoration,
  IRange,
  ITextModel,
  Range,
} from '@opensumi/ide-monaco';
import { space } from '@opensumi/ide-utils/lib/strings';

import styles from './styles.module.less';

// @internal
interface IDeltaData extends IModelDeltaDecoration {
  length: number;
  dispose(): void;
}

export interface IEnhanceModelDeltaDecoration extends IDeltaData {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
  hide(): void;
  resume(): void;
  getActualRange(): IRange;
  setActualRange(newRange: IRange): void;
}

// @internal
class DeltaDecorations implements IEnhanceModelDeltaDecoration {
  length: number;
  range: IRange;
  options: IModelDecorationOptions;

  private _actualRange: IRange;

  constructor(
    public readonly id: string,
    public readonly editorDecoration: IModelDeltaDecoration,
    private readonly codeEditor: ICodeEditor,
    private readonly deltaData: Partial<IDeltaData>,
  ) {
    if (isUndefined(deltaData.length)) {
      this.length = editorDecoration.range.endLineNumber - editorDecoration.range.startLineNumber;
    } else {
      this.length = deltaData.length;
    }

    this.range = editorDecoration.range;
    this.options = editorDecoration.options;

    this.setActualRange(this.range);
  }

  private changeVisibility(newClassName: string, newRange?: Range): void {
    if (!this.options.className) {
      return;
    }

    const classList = this.options.className
      .split(space)
      .filter((s) => s !== styles.hidden && s !== styles.visible)
      .filter(Boolean);
    classList.push(newClassName);

    this.options.className = classList.join(space);

    this.codeEditor.changeDecorations((accessor) => {
      accessor.changeDecorationOptions(this.id, this.options);
      accessor.changeDecoration(this.id, newRange ?? this.range);
    });
  }

  setActualRange(newRange: IRange): void {
    this._actualRange = newRange;
  }

  getActualRange(): IRange {
    return this._actualRange;
  }

  dispose(): void {
    this.deltaData.dispose?.();
  }

  hide(): void {
    const startPosition = { lineNumber: this._actualRange.startLineNumber, column: 1 };
    const newRange = Range.fromPositions(startPosition);
    this.changeVisibility(styles.hidden, newRange);
  }

  resume(): void {
    this.changeVisibility(styles.visible);
  }
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
      d.setActualRange(newRange ?? range);

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

  set(decorations: (IModelDeltaDecoration & Partial<Pick<IEnhanceModelDeltaDecoration, 'length'>>)[]): void {
    this.clear();

    this.codeEditor.changeDecorations((accessor: IModelDecorationsChangeAccessor) => {
      const newDecorations: IEnhanceModelDeltaDecoration[] = [];

      for (const decoration of decorations) {
        const id = accessor.addDecoration(decoration.range, decoration.options);
        newDecorations.push(
          new DeltaDecorations(id, decoration, this.codeEditor, {
            length: decoration.length,
            dispose: () => this.delete(id),
          }),
        );
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
