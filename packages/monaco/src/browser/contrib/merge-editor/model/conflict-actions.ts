import { Injectable, Optional } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-common';
import { ModelDecorationOptions } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';

import { ICodeEditor, IModelDecorationOptions, IModelDeltaDecoration } from '../../../monaco-api/editor';
import { IActionsDescription } from '../types';
import { BaseCodeEditor } from '../view/editors/baseCodeEditor';

export interface IActionsDecoration {
  id: string;
  readonly editorDecoration: IModelDeltaDecoration;
}

@Injectable({ multiple: false })
export class ConflictActions extends Disposable {
  private deltaDecoration: IActionsDecoration[] = [];

  private actionsCollect: Map<string, IActionsDescription> = new Map();

  private get editor(): ICodeEditor {
    return this.codeEditor.getEditor();
  }

  constructor(@Optional() private readonly codeEditor: BaseCodeEditor) {
    super();
  }

  private createActionDecoration(action: IActionsDescription): IActionsDecoration {
    const { range } = action;

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
      this.actionsCollect.set(range.id, action);

      return this.createActionDecoration(action);
    });

    this.editor.changeDecorations((accessor) => {
      newDecorations.forEach((d) => {
        d.id = accessor.addDecoration(d.editorDecoration.range, d.editorDecoration.options);
      });
      this.deltaDecoration = newDecorations;
    });
  }

  public clearActions(id: string): void {
    if (this.actionsCollect.has(id)) {
      const actions = this.actionsCollect.get(id);

      const matchDecoration = this.deltaDecoration.find(
        (d) => d.editorDecoration.options.description === actions!.range.id,
      );
      if (matchDecoration) {
        this.clearDecorationsById(matchDecoration.id);
      }

      this.actionsCollect.delete(id);
    }
  }

  public updateActions(id: string, action: IActionsDescription): void {
    if (this.actionsCollect.has(id)) {
      const preAction = this.actionsCollect.get(id);

      let matchIndex: number | undefined;
      const matchDecoration = this.deltaDecoration.find((d, idx) => {
        if (d.editorDecoration.options.description === id) {
          matchIndex = idx;
          return true;
        }
        return false;
      });

      if (matchDecoration) {
        const { id: decorationId } = matchDecoration;
        this.editor.changeDecorations((accessor) => {
          const range = action.range.toRange();
          const decorationOptions = action.decorationOptions as IModelDecorationOptions;

          accessor.changeDecoration(decorationId, range);
          accessor.changeDecorationOptions(decorationId, decorationOptions);

          matchDecoration.editorDecoration.range = range;
          matchDecoration.editorDecoration.options = decorationOptions;
        });

        this.actionsCollect.set(id, action);
        if (typeof matchIndex === 'number') {
          this.deltaDecoration.splice(matchIndex, 1, matchDecoration);
        }
      }
    }
  }

  public getActions(id: string): IActionsDescription | undefined {
    return this.actionsCollect.get(id);
  }
}
