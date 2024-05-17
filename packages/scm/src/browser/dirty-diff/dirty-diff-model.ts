import { Autowired, Injectable, Optional } from '@opensumi/di';
import {
  Disposable,
  DisposableStore,
  Emitter,
  Event,
  IContextKey,
  IContextKeyService,
  IDisposable,
  ILineChange,
  ISplice,
  ThrottledDelayer,
  URI,
  Uri,
  arrays,
  dispose,
  first,
  toDisposable,
} from '@opensumi/ide-core-browser';
import { RawContextKey } from '@opensumi/ide-core-browser/lib/raw-context-key';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { IEditorDocumentModel, IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { DetailedLineRangeMapping } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/rangeMapping';
import { IEditorWorkerService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/editorWorker';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import { IDirtyDiffModel, ISCMRepository, SCMService } from '../../common';

import { compareChanges, getModifiedEndLineNumber } from './dirty-diff-util';
import { DirtyDiffWidget } from './dirty-diff-widget';

import type { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

const { sortedDiff } = arrays;

export const isDirtyDiffVisible = new RawContextKey<boolean>('dirtyDiffVisible', false);

@Injectable({ multiple: true })
export class DirtyDiffModel extends Disposable implements IDirtyDiffModel {
  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  private isDirtyDiffVisible: IContextKey<boolean>;

  private _originalModel: IEditorDocumentModel | null;
  get original(): IEditorDocumentModel | null {
    return this._originalModel;
  }

  private _editorModel: IEditorDocumentModel | null;
  get modified(): IEditorDocumentModel | null {
    return this._editorModel;
  }

  private diffDelayer: ThrottledDelayer<ILineChange[] | null> | null;
  private _originalURIPromise?: Promise<Uri | null>;
  private repositoryDisposables = new Set<IDisposable>();
  private readonly originalModelDisposables: DisposableStore;

  private _onDidChange = new Emitter<ISplice<ILineChange>[]>();
  readonly onDidChange: Event<ISplice<ILineChange>[]> = this._onDidChange.event;

  private _changes: ILineChange[] = [];
  get changes(): ILineChange[] {
    return this._changes;
  }

  private _widget: DirtyDiffWidget | null;

  @Autowired(SCMService)
  private readonly scmService: SCMService;

  @Autowired(IEditorDocumentModelService)
  private readonly documentModelManager: IEditorDocumentModelService;

  @Autowired(EditorCollectionService)
  private readonly editorService: EditorCollectionService;

  static heightInLines = 10;

  // TODO: dynamic
  static maxFileSize = 50;

  private get editorWorkerService(): IEditorWorkerService {
    return StandaloneServices.get(IEditorWorkerService);
  }

  constructor(@Optional() editorModel: IEditorDocumentModel) {
    super();
    this._editorModel = editorModel;
    this.diffDelayer = new ThrottledDelayer<ILineChange[]>(200);
    this.addDispose(
      Disposable.create(() => {
        if (this.diffDelayer) {
          if (!this.diffDelayer.isTriggered()) {
            this.diffDelayer.cancel();
          }
          this.diffDelayer = null;
        }
      }),
    );

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

    this.isDirtyDiffVisible = isDirtyDiffVisible.bind(this.contextKeyService);
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
  private async diff(): Promise<ILineChange[] | null> {
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
      {
        ignoreTrimWhitespace: false,
        maxComputationTimeMs: 1000,
        computeMoves: false,
      },
      'advanced',
    );
    return ret && this.getLineChanges(ret.changes);
  }

  // copy by https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/services/editorSimpleWorker.ts#L426
  private getLineChanges(changes: readonly DetailedLineRangeMapping[]): ILineChange[] {
    return changes.map((m) => [
      m.original.startLineNumber,
      m.original.endLineNumberExclusive,
      m.modified.startLineNumber,
      m.modified.endLineNumberExclusive,
      m.innerChanges?.map((m) => [
        m.originalRange.startLineNumber,
        m.originalRange.startColumn,
        m.originalRange.endLineNumber,
        m.originalRange.endColumn,
        m.modifiedRange.startLineNumber,
        m.modifiedRange.startColumn,
        m.modifiedRange.endLineNumber,
        m.modifiedRange.endColumn,
      ]),
    ]);
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
    return first(this.scmService.repositories.map((r) => () => r.provider.getOriginalResource(uri as Uri)));
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
        if (change[2] > lineNumber) {
          return i;
        }
      }
    }

    return 0;
  }

  findNextClosestChangeLineNumber(lineNumber: number, inclusive = true) {
    // FIXME: handle changes = []
    const index = this.findNextClosestChange(lineNumber, inclusive);
    return this.changes[index][2];
  }

  // 查找上一个changes
  private findPreviousClosestChange(lineNumber: number, inclusive = true): number {
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const change = this.changes[i];

      if (inclusive) {
        if (change[2] <= lineNumber) {
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
    return this.changes[index][2];
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
        hideUnchangedRegions: {
          enabled: false,
        },
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

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const that = this;

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

      function refreshWidget(current: number, currentChange: ILineChange) {
        widget.updateCurrent(current);
        widget.show(monaco.positionToRange(currentChange[3] - 1), DirtyDiffModel.heightInLines);
        that.isDirtyDiffVisible.set(true);
      }

      widget.onDispose(() => {
        this._widget = null;
        that.isDirtyDiffVisible.set(false);
      });
    }
  }

  dispose(): void {
    super.dispose();

    this._editorModel = null;
    this._originalModel = null;

    this.repositoryDisposables.forEach((d) => dispose(d));
    this.repositoryDisposables.clear();
  }
}
