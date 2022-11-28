import { Injectable, Optional } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';

import { ICodeEditor, IModelDeltaDecoration } from '../../../monaco-api/editor';
import { IActionsDescription } from '../types';
import { BaseCodeEditor } from '../view/editors/baseCodeEditor';

export interface IActionsDecoration {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
}

@Injectable({ multiple: false })
export class ConflictActions extends Disposable {
  private deltaDecoration: IActionsDecoration[] = [];

  private actionsCollect: Map<number, IActionsDescription> = new Map();

  private get editor(): ICodeEditor {
    return this.codeEditor.getEditor();
  }

  constructor(@Optional() private readonly codeEditor: BaseCodeEditor) {
    super();
  }

  public override dispose(): void {
    super.dispose();
    this.actionsCollect.clear();
  }

  public clearDecorations(): void {
    this.editor.changeDecorations((accessor) => {
      for (const decoration of this.deltaDecoration) {
        accessor.removeDecoration(decoration.id);
      }
      this.deltaDecoration = [];
    });
  }

  public clearDecorationsById(id: string): void {
    this.editor.changeDecorations((accessor) => {
      if (id) {
        accessor.removeDecoration(id);

        this.deltaDecoration = this.deltaDecoration.filter((d) => d.id !== id);
      }
    });
  }

  public setActions(actions: IActionsDescription[]): void {
    const newDecorations: IActionsDecoration[] = actions.map((action) => {
      const { range } = action;
      this.actionsCollect.set(range.startLineNumber, action);

      return {
        id: '',
        editorDecoration: {
          range: {
            startLineNumber: range.startLineNumber,
            startColumn: 0,
            endLineNumber: range.startLineNumber,
            endColumn: 0,
          },
          options: ModelDecorationOptions.register({
            description: range.id,
            ...action.decorationOptions,
          }),
        },
      };
    });

    this.editor.changeDecorations((accessor) => {
      accessor
        .deltaDecorations(
          this.deltaDecoration.map((d) => d.id),
          newDecorations.map((d) => d.editorDecoration),
        )
        .forEach((id, i) => (newDecorations[i].id = id));
      this.deltaDecoration = newDecorations;
    });
  }

  public clearActions(line: number): void {
    if (this.actionsCollect.has(line)) {
      const actions = this.actionsCollect.get(line);

      const matchDecoration = this.deltaDecoration.find(
        (d) => d.editorDecoration.options.description === actions!.range.id,
      );
      if (matchDecoration) {
        this.clearDecorationsById(matchDecoration.id);
      }

      this.actionsCollect.delete(line);
    }
  }

  public getActions(line: number): IActionsDescription | undefined {
    return this.actionsCollect.get(line);
  }
}
