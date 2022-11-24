import { Injectable, Optional } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { IEditorDecorationsCollection } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';

import { ICodeEditor, IModelDeltaDecoration } from '../../../monaco-api/editor';
import { ITextModel } from '../../../monaco-api/types';
import { IActionsDescription } from '../types';
import { BaseCodeEditor } from '../view/editors/baseCodeEditor';

import { LineRange } from './line-range';

@Injectable({ multiple: false })
export class ConflictActions extends Disposable {
  private decorationsCollection: IEditorDecorationsCollection;
  private actionsCollect: Map<number, IActionsDescription>;

  private get editor(): ICodeEditor {
    return this.codeEditor.getEditor();
  }

  constructor(@Optional() private readonly codeEditor: BaseCodeEditor) {
    super();

    this.decorationsCollection = this.editor.createDecorationsCollection();
    this.actionsCollect = new Map();
  }

  public override dispose(): void {
    super.dispose();
    this.decorationsCollection.clear();
    this.actionsCollect.clear();
  }

  public setActions(actions: IActionsDescription[]): void {
    const newDecorations: IModelDeltaDecoration[] = actions.map((action) => {
      const { range } = action;
      this.actionsCollect.set(range.startLineNumber, action);

      return {
        range: {
          startLineNumber: range.startLineNumber,
          startColumn: 0,
          endLineNumber: range.startLineNumber,
          endColumn: 0,
        },
        options: ModelDecorationOptions.register(action.decorationOptions),
      };
    });

    this.decorationsCollection.set(newDecorations);
  }

  public getActions(line: number): IActionsDescription | undefined {
    return this.actionsCollect.get(line);
  }

  public applyLineRangeEdits(model: ITextModel, edits: { range: LineRange; text: string }[]): void {
    model.pushStackElement();
    model.pushEditOperations(
      null,
      edits.map((edit) => {
        const { range, text } = edit;

        return {
          range: range.toRange(),
          isAutoWhitespaceEdit: false,
          text: text + (range.isEmpty ? '\n' : ''),
        };
      }),
      () => null,
    );
    model.pushStackElement();
  }
}
