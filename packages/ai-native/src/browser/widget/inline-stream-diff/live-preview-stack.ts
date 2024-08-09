import { ITextModel, Uri } from '@opensumi/ide-monaco';
import {
  IResourceUndoRedoElement,
  UndoRedoElementType,
} from '@opensumi/monaco-editor-core/esm/vs/platform/undoRedo/common/undoRedo';

import { LivePreviewDiffDecorationModel } from './live-preview.decoration';

export class LivePreviewUndoRedoStackElement implements IResourceUndoRedoElement {
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

  constructor(private readonly model: ITextModel) {}

  attachModel(newDecorationModel: LivePreviewDiffDecorationModel): void {
    this.decorationModel = newDecorationModel;
  }

  private _undo: (model: LivePreviewDiffDecorationModel) => void;
  registerUndo(undo: (model: LivePreviewDiffDecorationModel) => void): void {
    this._undo = undo;
  }

  undo(): void | Promise<void> {
    this._undo?.(this.decorationModel);
  }

  private _redo: (model: LivePreviewDiffDecorationModel) => void;
  registerRedo(redo: (model: LivePreviewDiffDecorationModel) => void): void {
    this._redo = redo;
  }
  redo() {
    this._redo?.(this.decorationModel);
  }
}
