import { Disposable, Emitter, Event, isDefined, isUndefined, uuid } from '@opensumi/ide-core-common';
import {
  ICodeEditor,
  IContentSizeChangedEvent,
  IModelDecorationOptions,
  IModelDeltaDecoration,
  IPosition,
  IRange,
  ITextModel,
} from '@opensumi/ide-monaco';
import { UndoRedoGroup } from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

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
  decorationId: string;
  isHidden: boolean;
  readonly editorDecoration: IModelDeltaDecoration;
  show(): void;
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

export class DeltaDecorations implements IEnhanceModelDeltaDecoration {
  length: number;
  range: IRange;
  options: IModelDecorationOptions;

  private resumeRange: IRange;
  private _decorationId: string;
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

  get decorationId(): string {
    return this._decorationId;
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

  setRange(newRange: IRange): void {
    this.range = newRange;
  }

  getRange(): IRange {
    return this.range;
  }

  dispose(): void {
    this.hide();
    this.deltaData.dispose?.();
  }

  show(): void {
    this.codeEditor.changeDecorations((accessor) => {
      this._decorationId = accessor.addDecoration(this.range, this.options);
    });
  }

  hide(): void {
    this.resumeRange = this.range;
    this._hidden = true;
    if (this._decorationId) {
      this.codeEditor.changeDecorations((accessor) => {
        accessor.removeDecoration(this._decorationId);
      });
    }
  }

  resume(): void {
    if (!this._hidden) {
      return;
    }

    this._hidden = false;
    this.codeEditor.changeDecorations((accessor) => {
      this._decorationId = accessor.addDecoration(this.resumeRange, this.options);
    });
  }
}

export class EnhanceDecorationsCollection<
  T extends IEnhanceModelDeltaDecoration = IEnhanceModelDeltaDecoration,
> extends Disposable {
  private deltaDecorations: T[] = [];

  protected readonly _onDidDecorationsChange = this.registerDispose(new Emitter<T[]>());
  public readonly onDidDecorationsChange: Event<T[]> = this._onDidDecorationsChange.event;

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
        decorationId,
        editorDecoration: { range },
      } = d;

      const newRange = this.model.getDecorationRange(decorationId);
      d.setRange(newRange ?? range);

      return d;
    });

    this._onDidDecorationsChange.fire(this.deltaDecorations);
  }

  private delete(id: string): void {
    this.deltaDecorations = this.deltaDecorations.filter((d) => d.id !== id);
  }

  protected createDecorations(metaData: IDeltaDecorationsOptions) {
    return new DeltaDecorations(metaData) as unknown as T;
  }

  set(decorations: (IModelDeltaDecoration & Partial<Pick<T, 'length' | 'isHidden' | 'group'>>)[]): void {
    this.clear();

    this.deltaDecorations = decorations.map((decoration) => {
      const id = uuid(6);

      const dec = this.createDecorations({
        id,
        editorDecoration: decoration,
        codeEditor: this.codeEditor,
        isHidden: decoration.isHidden,
        group: decoration.group,
        deltaData: {
          dispose: () => this.delete(id),
          length: decoration.length,
        },
      });

      dec.show();

      return dec;
    });
  }

  getDecorations(): T[] {
    return this.deltaDecorations;
  }

  getDecorationByGroup(group: UndoRedoGroup): T | undefined {
    return this.deltaDecorations.find((d) => d.group === group);
  }

  getDecorationByLineNumber(lineNumber: number): T | undefined {
    return this.deltaDecorations.find((d) => d.getRange().startLineNumber === lineNumber);
  }

  clear(): void {
    this.deltaDecorations.map((d) => d.dispose());
    this.deltaDecorations = [];
  }
}
