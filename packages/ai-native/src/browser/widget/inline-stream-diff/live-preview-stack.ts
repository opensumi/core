import { IPosition, ITextModel, Uri } from '@opensumi/ide-monaco';
import {
  IResourceUndoRedoElement,
  UndoRedoElementType,
} from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import { ITextLinesTokens } from './live-preview.component';
import { LivePreviewDiffDecorationModel } from './live-preview.decoration';

export type IWidgetStatus = 'accept' | 'discard' | 'pending';

export interface IRemovedWidgetState {
  textLines: ITextLinesTokens[];
  position: IPosition;
}

class StackData {
  static create(): StackData {
    return new StackData();
  }

  constructor() {}
}

export class LivePreviewUndoRedoStackElement implements IResourceUndoRedoElement {
  private data: StackData;
  private decorationModel: LivePreviewDiffDecorationModel;

  get type(): UndoRedoElementType.Resource {
    return UndoRedoElementType.Resource;
  }

  get label(): string {
    return 'Live.Preview.UndoRedo';
  }

  get code(): string {
    return 'Live.Preview.UndoRedo';
  }

  get resource(): Uri {
    return this.model.uri;
  }

  confirmBeforeUndo = false;

  constructor(private readonly model: ITextModel) {
    this.data = StackData.create();
  }

  append(newDecorationModel: LivePreviewDiffDecorationModel): void {
    this.decorationModel = newDecorationModel;
  }

  private _undoFn: any;
  registerUndo(fn): void {
    this._undoFn = fn;
  }

  private _redoFn: any;
  registerRedo(fn): void {
    this._redoFn = fn;
  }

  undo(): void | Promise<void> {
    // this._undoFn(this.decorationModel);
  }
  redo(): void | Promise<void> {
    // this.redo(this.decorationModel);
  }
}
