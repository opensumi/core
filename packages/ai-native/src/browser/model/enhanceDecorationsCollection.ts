import { Disposable, Emitter, Event, isDefined, isUndefined } from '@opensumi/ide-core-common';
import {
  ICodeEditor,
  IContentSizeChangedEvent,
  IModelDecorationOptions,
  IModelDecorationsChangeAccessor,
  IModelDeltaDecoration,
  IPosition,
  IRange,
  ITextModel,
  Range,
} from '@opensumi/ide-monaco';
import { space } from '@opensumi/ide-utils/lib/strings';
import { UndoRedoGroup } from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import styles from './styles.module.less';

export interface IDecorationSerializableState {
  startPosition: IPosition;
  endPosition: IPosition;
  len: number;
}

interface IDeltaData extends IModelDeltaDecoration {
  length: number;
  dispose(): void;
}

export interface IEnhanceModelDeltaDecoration extends IDeltaData {
  id: string;
  isHidden: boolean;
  readonly editorDecoration: IModelDeltaDecoration;
  hide(): void;
  resume(): void;
  getRange(): IRange;
  setRange(newRange: IRange): void;
  group?: UndoRedoGroup;
  setGroup(group: UndoRedoGroup): void;
}

export interface IDeltaDecorationsOptions {
  id: string;
  editorDecoration: IModelDeltaDecoration;
  codeEditor: ICodeEditor;
  deltaData: Partial<IDeltaData>;
  isHidden?: boolean;
  group?: UndoRedoGroup;
}

class DeltaDecorations implements IEnhanceModelDeltaDecoration {
  length: number;
  range: IRange;
  options: IModelDecorationOptions;

  private resumeRange: IRange;
  private _group: UndoRedoGroup;

  private _hidden = false;
  get isHidden(): boolean {
    return this._hidden;
  }

  get codeEditor(): ICodeEditor {
    return this.metadata.codeEditor;
  }

  get deltaData(): Partial<IDeltaData> {
    return this.metadata.deltaData;
  }

  get id(): string {
    return this.metadata.id;
  }

  get editorDecoration(): IModelDeltaDecoration {
    return this.metadata.editorDecoration;
  }

  public get group(): UndoRedoGroup {
    return this._group;
  }

  constructor(protected readonly metadata: IDeltaDecorationsOptions) {
    const { editorDecoration, deltaData, isHidden, group } = metadata;

    if (isUndefined(deltaData.length)) {
      this.length = editorDecoration.range.endLineNumber - editorDecoration.range.startLineNumber;
    } else {
      this.length = deltaData.length;
    }

    this.range = editorDecoration.range;
    this.options = editorDecoration.options;

    this.resumeRange = this.range;

    this._hidden = !!isHidden;
    if (this._hidden) {
      this.hide();
    }

    if (isDefined(group)) {
      this.setGroup(group);
    }
  }

  setGroup(group): void {
    this._group = group;
  }

  private changeVisibility(newClassName: string, newRange: Range): void {
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
      accessor.changeDecoration(this.id, newRange);
    });
  }

  setRange(newRange: IRange): void {
    this.range = newRange;
  }

  getRange(): IRange {
    return this.range;
  }

  dispose(): void {
    this.deltaData.dispose?.();
  }

  hide(): void {
    this.resumeRange = this.range;
    this._hidden = true;
    const startPosition = { lineNumber: this.range.startLineNumber, column: 1 };
    const newRange = Range.fromPositions(startPosition);
    this.changeVisibility(styles.hidden, newRange);
  }

  resume(): void {
    this._hidden = false;
    this.changeVisibility(styles.visible, Range.lift(this.resumeRange));
  }
}

export class EnhanceDecorationsCollection extends Disposable {
  private deltaDecorations: IEnhanceModelDeltaDecoration[] = [];

  protected readonly _onDidDecorationsChange = this.registerDispose(new Emitter<IEnhanceModelDeltaDecoration[]>());
  public readonly onDidDecorationsChange: Event<IEnhanceModelDeltaDecoration[]> = this._onDidDecorationsChange.event;

  private get model(): ITextModel {
    return this.codeEditor.getModel()!;
  }

  constructor(private readonly codeEditor: ICodeEditor) {
    super();

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
      d.setRange(newRange ?? range);

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

  protected createDecorations(metaData: IDeltaDecorationsOptions) {
    return new DeltaDecorations(metaData);
  }

  set(
    decorations: (IModelDeltaDecoration &
      Partial<Pick<IEnhanceModelDeltaDecoration, 'length' | 'isHidden' | 'group'>>)[],
  ): void {
    this.clear();

    this.codeEditor.changeDecorations((accessor: IModelDecorationsChangeAccessor) => {
      const newDecorations: IEnhanceModelDeltaDecoration[] = [];

      for (const decoration of decorations) {
        const id = accessor.addDecoration(decoration.range, decoration.options);
        newDecorations.push(
          this.createDecorations({
            id,
            editorDecoration: decoration,
            codeEditor: this.codeEditor,
            isHidden: decoration.isHidden,
            group: decoration.group,
            deltaData: {
              dispose: () => this.delete(id),
              length: decoration.length,
            },
          }),
        );
      }

      this.deltaDecorations = newDecorations;
    });
  }

  getDecorations(): IEnhanceModelDeltaDecoration[] {
    return this.deltaDecorations;
  }

  getDecorationByGroup(group: UndoRedoGroup): IEnhanceModelDeltaDecoration | undefined {
    return this.deltaDecorations.find((d) => d.group === group);
  }

  getDecorationByLineNumber(lineNumber: number): IEnhanceModelDeltaDecoration | undefined {
    return this.deltaDecorations.find((d) => d.getRange().startLineNumber === lineNumber);
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
