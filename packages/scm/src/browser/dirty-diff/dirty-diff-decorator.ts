import { IEditorDecorationCollectionService } from '@ali/ide-editor/lib/browser';
import { Autowired, Injectable, Optional } from '@ali/common-di';
import { WorkbenchEditorService, OverviewRulerLane } from '@ali/ide-editor';
import { PreferenceService } from '@ali/ide-core-browser';
import { IChange } from '@ali/ide-core-common';
import { Disposable } from '@ali/ide-core-common/lib/disposable';
import { themeColorFromId } from '@ali/ide-theme';

import { overviewRulerModifiedForeground, overviewRulerDeletedForeground, overviewRulerAddedForeground } from '../scm-color';
import { SCMService } from '../../common';
import { SCMPreferences } from '../scm-preference';
import { DirtyDiffModel } from './dirty-diff-model';

enum ChangeType {
  Modify,
  Add,
  Delete,
}

function getChangeType(change: IChange): ChangeType {
  if (change.originalEndLineNumber === 0) {
    return ChangeType.Add;
  } else if (change.modifiedEndLineNumber === 0) {
    return ChangeType.Delete;
  } else {
    return ChangeType.Modify;
  }
}

@Injectable()
export class DirtyDiffDecorator extends Disposable {
  static createDecoration(
    className: string,
    foregroundColor: string,
    options: { gutter: boolean, overview: boolean, isWholeLine: boolean },
  ): monaco.textModel.ModelDecorationOptions {
    const decorationOptions: monaco.editor.IModelDecorationOptions = {
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

    return monaco.textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  private modifiedOptions: monaco.textModel.ModelDecorationOptions;
  private addedOptions: monaco.textModel.ModelDecorationOptions;
  private deletedOptions: monaco.textModel.ModelDecorationOptions;
  private decorations: string[] = [];
  private editorModel: monaco.editor.ITextModel | null;

  @Autowired(IEditorDecorationCollectionService)
  editorDecorationService: IEditorDecorationCollectionService;

  @Autowired(SCMService)
  scmService: SCMService;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(SCMPreferences)
  scmPreferenceService: SCMPreferences;

  constructor(
    @Optional() editorModel: monaco.editor.ITextModel,
    @Optional() private model: DirtyDiffModel,
  ) {
    super();
    this.editorModel = editorModel;
    const decorations = this.scmPreferenceService['scm.diffDecorations'];
    const gutter = decorations === 'all' || decorations === 'gutter';
    const overview = decorations === 'all' || decorations === 'overview';
    const options = { gutter, overview, isWholeLine: true };

    this.modifiedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-modified', overviewRulerModifiedForeground, options);
    this.addedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-added', overviewRulerAddedForeground, options);
    this.deletedOptions = DirtyDiffDecorator.createDecoration('dirty-diff-deleted', overviewRulerDeletedForeground, { ...options, isWholeLine: false });

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
              startLineNumber, startColumn: 1,
              endLineNumber, endColumn: 1,
            },
            options: this.addedOptions,
          };
        case ChangeType.Delete:
          return {
            range: {
              startLineNumber, startColumn: Number.MAX_VALUE,
              endLineNumber: startLineNumber, endColumn: Number.MAX_VALUE,
            },
            options: this.deletedOptions,
          };
        case ChangeType.Modify:
          return {
            range: {
              startLineNumber, startColumn: 1,
              endLineNumber, endColumn: 1,
            },
            options: this.modifiedOptions,
          };
      }
    });

    this.decorations = this.editorModel.deltaDecorations(this.decorations, decorations);
  }

  dispose(): void {
    super.dispose();

    if (this.editorModel && !this.editorModel.isDisposed()) {
      this.editorModel.deltaDecorations(this.decorations, []);
    }

    this.editorModel = null;
    this.decorations = [];
  }
}
