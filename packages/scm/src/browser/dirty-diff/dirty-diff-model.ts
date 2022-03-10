import { Autowired, Injectable, Optional } from '@opensumi/di';
import { Emitter, Event, sortedDiff, ThrottledDelayer, IChange, positionToRange } from '@opensumi/ide-core-common';
import { first } from '@opensumi/ide-core-common/lib/async';
import {
  IDisposable,
  dispose,
  Disposable,
  DisposableStore,
  toDisposable,
} from '@opensumi/ide-core-common/lib/disposable';
import { ISplice } from '@opensumi/ide-core-common/lib/sequence';
import { Uri, URI } from '@opensumi/ide-core-common/lib/uri';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService, IEditorDocumentModel } from '@opensumi/ide-editor/lib/browser';
import type { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import { IEditorWorkerService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/editorWorkerService';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { StaticServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { SCMService, ISCMRepository, IDirtyDiffModel } from '../../common';

import { compareChanges, getModifiedEndLineNumber } from './dirty-diff-util';
import { DirtyDiffWidget } from './dirty-diff-widget';

@Injectable({ multiple: true })
export class DirtyDiffModel extends Disposable implements IDirtyDiffModel {
  private _originalModel: IEditorDocumentModel | null;
  get original(): IEditorDocumentModel | null {
    return this._originalModel;
  }

  private _editorModel: IEditorDocumentModel | null;
  get modified(): IEditorDocumentModel | null {
    return this._editorModel;
  }

  private diffDelayer: ThrottledDelayer<IChange[] | null> | null;
  private _originalURIPromise?: Promise<Uri | null>;
  private repositoryDisposables = new Set<IDisposable>();
  private readonly originalModelDisposables: DisposableStore;

  private _onDidChange = new Emitter<ISplice<IChange>[]>();
  readonly onDidChange: Event<ISplice<IChange>[]> = this._onDidChange.event;

  private _changes: IChange[] = [];
  get changes(): IChange[] {
    return this._changes;
  }

  private _widget: DirtyDiffWidget | null;

  @Autowired(SCMService)
  private readonly scmService: SCMService;

  @Autowired(IEditorDocumentModelService)
  private readonly documentModelManager: IEditorDocumentModelService;

  @Autowired(EditorCollectionService)
  private readonly editorService: EditorCollectionService;

  // TODO: dynamic
  static heightInLines = 18;

  // TODO: dynamic
  static maxFileSize = 50;

  private get editorWorkerService(): IEditorWorkerService {
    return StaticServices.editorWorkerService.get();
  }

  constructor(@Optional() editorModel: IEditorDocumentModel) {
    super();
    this._editorModel = editorModel;
    this.diffDelayer = new ThrottledDelayer<IChange[]>(200);

    this.addDispose(editorModel.getMonacoModel().onDidChangeContent(() => this.triggerDiff()));
    this.addDispose(
      editorModel.onDidChangeEncoding(() => {
        this.diffDelayer?.cancel();
        this._originalModel = null;
        this._originalURIPromise = undefined;
        this._changes = [];
        this.triggerDiff();
      }),
    );
    this.addDispose(this.scmService.onDidAddRepository(this.onDidAddRepository, this));
    this.scmService.repositories.forEach((r) => this.onDidAddRepository(r));

    this.triggerDiff();

    this.originalModelDisposables = new DisposableStore();
    this.addDispose(this.originalModelDisposables);
  }

  private onDidAddRepository(repository: ISCMRepository): void {
    const disposables = new DisposableStore();

    this.repositoryDisposables.add(disposables);
    disposables.add(toDisposable(() => this.repositoryDisposables.delete(disposables)));

    const onDidChange = Event.any(repository.provider.onDidChange, repository.provider.onDidChangeResources);
    disposables.add(onDidChange(this.triggerDiff, this));

    const onDidRemoveThis = Event.filter(this.scmService.onDidRemoveRepository, (r) => r === repository);
    disposables.add(onDidRemoveThis(() => dispose(disposables), null));

    this.triggerDiff();
  }

  private triggerDiff(): Promise<any> {
    if (!this.diffDelayer) {
      return Promise.resolve(null);
    }

    return this.diffDelayer
      .trigger(() => this.diff())
      .then((changes) => {
        if (
          !this._editorModel ||
          this._editorModel.getMonacoModel().isDisposed() ||
          !this._originalModel ||
          this._originalModel.getMonacoModel().isDisposed()
        ) {
          return; // disposed
        }

        if (!changes || this._originalModel.getMonacoModel().getValueLength() === 0) {
          changes = [];
        }

        const diff = sortedDiff(this.changes, changes, compareChanges);
        this._changes = changes;

        if (diff.length > 0) {
          this._onDidChange.fire(diff);
        }
      });
  }

  private canSyncModelForDiff(model: ITextModel | undefined): boolean {
    if (!model) {
      return false;
    }
    const diffLimit = DirtyDiffModel.maxFileSize * 1024 * 1024; // MB
    const bufferTextLength = model.getValueLength();
    return diffLimit === 0 || bufferTextLength <= diffLimit;
  }

  // 计算 diff
  private async diff(): Promise<IChange[] | null> {
    const originalURI = await this.getOriginalURIPromise();
    if (!this._editorModel || this._editorModel.getMonacoModel().isDisposed() || !originalURI) {
      return []; // disposed
    }

    // 复用 monaco 内部的 canSyncModelForDiff
    if (
      !this.canSyncModelForDiff(this._originalModel?.getMonacoModel()) ||
      !this.canSyncModelForDiff(this._editorModel.getMonacoModel())
    ) {
      return []; // Files too large
    }

    // 复用 monaco 内部的 computeDiff 跟 computeDirtyDiff 参数不一致
    // 主要是 shouldComputeCharChanges#false, shouldPostProcessCharChanges#false
    const ret = await this.editorWorkerService.computeDiff(
      originalURI as monaco.Uri,
      this._editorModel.getMonacoModel().uri,
      false,
      // 新版本多了一个 maxComputationTime 参数，参考 VS Code 默认值设置为 1000
      1000,
    );
    return ret && ret.changes;
  }

  private getOriginalURIPromise(): Promise<Uri | null> {
    if (this._originalURIPromise) {
      return this._originalURIPromise;
    }

    this._originalURIPromise = this.getOriginalResource().then((originalUri) => {
      if (!this._editorModel) {
        // disposed
        return null;
      }

      if (!originalUri) {
        this._originalModel = null;
        return null;
      }

      if (this._originalModel && this._originalModel.uri.toString() === originalUri.toString()) {
        return originalUri;
      }

      return this.documentModelManager.createModelReference(new URI(originalUri)).then((docModelRef) => {
        if (!this._editorModel) {
          // disposed
          return null;
        }

        if (!docModelRef) {
          return null;
        }

        this._originalModel = docModelRef.instance;
        this._originalModel.updateEncoding(this._editorModel.encoding);

        const textEditorModel = this._originalModel.getMonacoModel();

        this.originalModelDisposables.clear();
        this.originalModelDisposables.add(docModelRef);
        this.originalModelDisposables.add(textEditorModel.onDidChangeContent(() => this.triggerDiff()));
        return originalUri;
      });
    });

    return this._originalURIPromise.finally(() => {
      this._originalURIPromise = undefined;
    });
  }

  private getOriginalResource(): Promise<Uri | null> {
    if (!this._editorModel) {
      return Promise.resolve(null);
    }

    const uri = this._editorModel.getMonacoModel().uri;
    // find the first matched scm repository
    return first(this.scmService.repositories.map((r) => () => r.provider.getOriginalResource(uri)));
  }

  // 查找下一个changes
  private findNextClosestChange(lineNumber: number, inclusive = true): number {
    for (let i = 0; i < this.changes.length; i++) {
      const change = this.changes[i];

      if (inclusive) {
        if (getModifiedEndLineNumber(change) >= lineNumber) {
          return i;
        }
      } else {
        if (change.modifiedStartLineNumber > lineNumber) {
          return i;
        }
      }
    }

    return 0;
  }

  findNextClosestChangeLineNumber(lineNumber: number, inclusive = true) {
    // FIXME: handle changes = []
    const index = this.findNextClosestChange(lineNumber, inclusive);
    return this.changes[index].modifiedStartLineNumber;
  }

  // 查找上一个changes
  private findPreviousClosestChange(lineNumber: number, inclusive = true): number {
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const change = this.changes[i];

      if (inclusive) {
        if (change.modifiedStartLineNumber <= lineNumber) {
          return i;
        }
      } else {
        if (getModifiedEndLineNumber(change) < lineNumber) {
          return i;
        }
      }
    }

    return this.changes.length - 1;
  }

  findPreviousClosestChangeLineNumber(lineNumber: number, inclusive = true) {
    const index = this.findPreviousClosestChange(lineNumber, inclusive);
    // FIXME: handle changes = []
    return this.changes[index].modifiedStartLineNumber;
  }

  getChangeFromRange(range: monaco.IRange) {
    const index = this.findNextClosestChange(range.startLineNumber);
    const change = this.changes[index];
    return { change, count: index + 1 };
  }

  async onClickDecoration(widget: DirtyDiffWidget, range: monaco.IRange) {
    if (this._widget) {
      if (this._widget === widget) {
        this._widget.dispose();
        return;
      } else {
        this._widget.dispose();
      }
    }

    this._widget = widget;

    if (this._originalModel && this._editorModel) {
      const originalUri = this._originalModel.uri;
      const editorUri = this._editorModel.uri;
      const editor = this.editorService.createDiffEditor(widget.getContentNode(), {
        automaticLayout: true,
        renderSideBySide: false,
      });
      const original = await this.documentModelManager.createModelReference(originalUri);
      const edit = await this.documentModelManager.createModelReference(editorUri);

      editor.compare(original, edit);

      editor.modifiedEditor.monacoEditor.updateOptions({ readOnly: true });
      editor.originalEditor.monacoEditor.updateOptions({ readOnly: true });

      editor.modifiedEditor.monacoEditor.revealLineInCenter(
        range.startLineNumber - Math.round(DirtyDiffModel.heightInLines / 2),
      );

      widget.addDispose(
        editor.originalEditor.monacoEditor.onDidChangeModelContent(() => {
          widget.relayout(DirtyDiffModel.heightInLines);
        }),
      );

      widget.addDispose(
        this.onDidChange(() => {
          const { change, count } = this.getChangeFromRange(range) || {};
          refreshWidget(count, change);
        }),
      );

      const { change, count } = this.getChangeFromRange(range) || {};
      if (count && change) {
        refreshWidget(count, change);
      }

      function refreshWidget(current: number, currentChange: IChange) {
        widget.updateCurrent(current);
        widget.show(
          positionToRange(currentChange.modifiedEndLineNumber || currentChange.modifiedStartLineNumber),
          DirtyDiffModel.heightInLines,
        );
      }

      widget.onDispose(() => {
        this._widget = null;
      });
    }
  }

  dispose(): void {
    super.dispose();

    this._editorModel = null;
    this._originalModel = null;

    if (this.diffDelayer) {
      this.diffDelayer.cancel();
      this.diffDelayer = null;
    }

    this.repositoryDisposables.forEach((d) => dispose(d));
    this.repositoryDisposables.clear();
  }
}
