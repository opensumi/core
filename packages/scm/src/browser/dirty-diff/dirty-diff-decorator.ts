import { Autowired, Injectable, Optional } from '@opensumi/di';
import { Disposable } from '@opensumi/ide-core-browser';
import { OverviewRulerLane } from '@opensumi/ide-editor';
import { IEditorDocumentModel } from '@opensumi/ide-editor/lib/browser';
import { themeColorFromId } from '@opensumi/ide-theme';
import * as model from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as textModel from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';

import {
  minimapGutterAddedBackground,
  minimapGutterDeletedBackground,
  minimapGutterModifiedBackground,
  overviewRulerAddedForeground,
  overviewRulerDeletedForeground,
  overviewRulerModifiedForeground,
} from '../scm-color';
import { SCMPreferences } from '../scm-preference';

import { DirtyDiffModel } from './dirty-diff-model';
import { ChangeType, getChangeType } from './dirty-diff-util';

@Injectable({ multiple: true })
export class DirtyDiffDecorator extends Disposable {
  /**
   * @param className
   * @param foregroundColor
   * @param options
   */
  static createDecoration(
    className: string,
    options: {
      gutter: boolean;
      overview: { active: boolean; color: string };
      minimap: { active: boolean; color: string };
      isWholeLine: boolean;
    },
  ): textModel.ModelDecorationOptions {
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'dirty-diff-decoration',
      isWholeLine: options.isWholeLine,
    };

    if (options.gutter) {
      decorationOptions.linesDecorationsClassName = `dirty-diff-glyph ${className}`;
    }

    if (options.overview.active) {
      decorationOptions.overviewRuler = {
        color: themeColorFromId(options.overview.color),
        position: OverviewRulerLane.Left,
      };
    }

    if (options.minimap.active) {
      decorationOptions.minimap = {
        color: themeColorFromId(options.minimap.color),
        position: model.MinimapPosition.Gutter,
      };
    }

    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  private addedOptions: textModel.ModelDecorationOptions;
  private modifiedOptions: textModel.ModelDecorationOptions;
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
    const minimap = decorations === 'all' || decorations === 'minimap';

    this.modifiedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-modified', {
      gutter,
      overview: { active: overview, color: overviewRulerModifiedForeground },
      minimap: { active: minimap, color: minimapGutterModifiedBackground },
      isWholeLine: true,
    });

    this.addedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-added', {
      gutter,
      overview: { active: overview, color: overviewRulerAddedForeground },
      minimap: { active: minimap, color: minimapGutterAddedBackground },
      isWholeLine: true,
    });

    this.deletedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-deleted', {
      gutter,
      overview: { active: overview, color: overviewRulerDeletedForeground },
      minimap: { active: minimap, color: minimapGutterDeletedBackground },
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
      const startLineNumber = change[2];
      const endLineNumber = change[3] - 1 || startLineNumber - 1;

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
              startLineNumber: startLineNumber - 1,
              startColumn: Number.MAX_VALUE,
              endLineNumber: startLineNumber > 0 ? startLineNumber - 1 : startLineNumber,
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

    this.decorations = this.editorModel.getMonacoModel().deltaDecorations(this.decorations, decorations);
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
