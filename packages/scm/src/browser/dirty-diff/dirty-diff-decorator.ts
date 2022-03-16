import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IChange } from '@opensumi/ide-core-common';
import { Disposable } from '@opensumi/ide-core-common/lib/disposable';
import { OverviewRulerLane } from '@opensumi/ide-editor';
import { IEditorDocumentModel } from '@opensumi/ide-editor/lib/browser';
import { themeColorFromId } from '@opensumi/ide-theme';
import * as model from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as textModel from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  overviewRulerModifiedForeground,
  overviewRulerDeletedForeground,
  overviewRulerAddedForeground,
} from '../scm-color';
import { SCMPreferences } from '../scm-preference';

import { DirtyDiffModel } from './dirty-diff-model';

enum ChangeType {
  Modify = 'Modify',
  Add = 'Add',
  Delete = 'Delete',
}

function getChangeType(change: IChange): ChangeType {
  if (change.originalEndLineNumber === 0) {
    return ChangeType.Add;
  } else if (change.modifiedEndLineNumber === 0) {
    return ChangeType.Delete;
  }
  return ChangeType.Modify;
}

@Injectable({ multiple: true })
export class DirtyDiffDecorator extends Disposable {
  /**
   * -------------------------------- IMPORTANT --------------------------------
   * 需要注意区分 model.IModelDecorationOptions 与 monaco.editor.IModelDecorationOptions 两个类型
   * 将 model.IModelDecorationOptions 类型的对象传给签名为 monaco.editor.IModelDecorationOptions 的方法时需要做 Type Assertion
   * 这是因为 monaco.d.ts 与 vs/editor/common/model 分别导出了枚举 TrackedRangeStickiness
   * 这种情况下两个枚举的类型是不兼容的，即使他们是同一段代码的编译产物
   * -------------------------------- IMPORTANT --------------------------------
   * @param className
   * @param foregroundColor
   * @param options
   */
  static createDecoration(
    className: string,
    foregroundColor: string,
    options: { gutter: boolean; overview: boolean; isWholeLine: boolean },
  ): textModel.ModelDecorationOptions {
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'dirty-diff',
      isWholeLine: options.isWholeLine,
    };

    if (options.gutter) {
      decorationOptions.linesDecorationsClassName = `dirty-diff-glyph ${className}`;
    }

    if (options.overview) {
      decorationOptions.overviewRuler = {
        color: themeColorFromId(foregroundColor),
        position: OverviewRulerLane.Left,
      };
    }

    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  private modifiedOptions: textModel.ModelDecorationOptions;
  private addedOptions: textModel.ModelDecorationOptions;
  private deletedOptions: textModel.ModelDecorationOptions;
  private decorations: string[] = [];
  private editorModel: IEditorDocumentModel | null;

  @Autowired(SCMPreferences)
  private readonly scmPreferences: SCMPreferences;

  constructor(@Optional() editorModel: IEditorDocumentModel, @Optional() private model: DirtyDiffModel) {
    super();
    this.editorModel = editorModel;
    const decorations = this.scmPreferences['scm.diffDecorations'];
    const gutter = decorations === 'all' || decorations === 'gutter';
    const overview = decorations === 'all' || decorations === 'overview';
    const options = { gutter, overview, isWholeLine: true };

    this.modifiedOptions = DirtyDiffDecorator.createDecoration(
      'dirty-diff-modified',
      overviewRulerModifiedForeground,
      options,
    );
    this.addedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-added', overviewRulerAddedForeground, options);
    this.deletedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-deleted', overviewRulerDeletedForeground, {
      ...options,
      isWholeLine: false,
    });

    this.addDispose(model.onDidChange(this.onDidChange, this));
  }

  private onDidChange(): void {
    if (!this.editorModel) {
      return;
    }
    const decorations = this.model.changes.map((change) => {
      const changeType = getChangeType(change);
      const startLineNumber = change.modifiedStartLineNumber;
      const endLineNumber = change.modifiedEndLineNumber || startLineNumber;

      switch (changeType) {
        case ChangeType.Add:
          return {
            range: {
              startLineNumber,
              startColumn: 1,
              endLineNumber,
              endColumn: 1,
            },
            options: this.addedOptions,
          };
        case ChangeType.Delete:
          return {
            range: {
              startLineNumber,
              startColumn: Number.MAX_VALUE,
              endLineNumber: startLineNumber,
              endColumn: Number.MAX_VALUE,
            },
            options: this.deletedOptions,
          };
        case ChangeType.Modify:
          return {
            range: {
              startLineNumber,
              startColumn: 1,
              endLineNumber,
              endColumn: 1,
            },
            options: this.modifiedOptions,
          };
      }
    });

    this.decorations = this.editorModel
      .getMonacoModel()
      .deltaDecorations(this.decorations, decorations as unknown as monaco.editor.IModelDeltaDecoration[]);
  }

  dispose(): void {
    super.dispose();

    if (this.editorModel && !this.editorModel.getMonacoModel().isDisposed()) {
      this.editorModel.getMonacoModel().deltaDecorations(this.decorations, []);
    }

    this.editorModel = null;
    this.decorations = [];
  }
}
