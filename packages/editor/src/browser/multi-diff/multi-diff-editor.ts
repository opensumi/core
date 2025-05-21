import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  Disposable,
  DisposableStore,
  Emitter,
  IDisposable,
  ILogger,
  OnEvent,
  URI,
  WithEventBus,
  isString,
} from '@opensumi/ide-core-common';
import {
  ValueWithChangeEventFromObservable,
  constObservable,
  derived,
  mapObservableArrayCached,
  observableFromValueWithChangeEvent,
  observableValue,
  recomputeInitiallyAndOnChange,
} from '@opensumi/ide-monaco/lib/common/observable';
import { IMessageService } from '@opensumi/ide-overlay';
import { ISelection } from '@opensumi/monaco-editor-core';
import { Dimension } from '@opensumi/monaco-editor-core/esm/vs/base/browser/dom';
import { ValueWithChangeEvent } from '@opensumi/monaco-editor-core/esm/vs/base/common/event';
import { ICodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { RefCounted } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/diffEditor/utils';
import {
  IDocumentDiffItem,
  IMultiDiffEditorModel,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/multiDiffEditor/model';
import { MultiDiffEditorWidget } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/multiDiffEditor/multiDiffEditorWidget';
import { IMultiDiffResourceId } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/widget/multiDiffEditor/multiDiffEditorWidgetImpl';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { IDiffEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/common/editorCommon';

import {
  EditorCollectionService,
  EditorType,
  IEditorDocumentModelRef,
  IResourceOpenOptions,
} from '../../common/editor';
import { IMultiDiffEditor, IMultiDiffSourceResolverService, IResolvedMultiDiffSource } from '../../common/multi-diff';
import { EditorDocumentModelContentChangedEvent, IEditorDocumentModelService } from '../doc-model/types';
import { DiffEditorPart, EditorCollectionServiceImpl } from '../editor-collection.service';
import { IConvertedMonacoOptions, IResource, ResourceDecorationNeedChangeEvent } from '../types';

@Injectable({ multiple: true })
export class BrowserMultiDiffEditor extends WithEventBus implements IMultiDiffEditor {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(IEditorDocumentModelService)
  private readonly documentModelManager: IEditorDocumentModelService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IMultiDiffSourceResolverService)
  private readonly multiDiffSourceResolverService: IMultiDiffSourceResolverService;

  @Autowired(EditorCollectionService)
  private readonly collectionService: EditorCollectionServiceImpl;

  @Autowired(ILogger)
  logger: ILogger;

  private multiDiffModelChangeEmitter = new Emitter<IMultiDiffEditorModel>();
  public readonly onMultiDiffModelChange = this.multiDiffModelChangeEmitter.event;

  private viewStateMap: Map<string, any> = new Map();
  private currentUri: URI | undefined;

  private multiDiffModel: IMultiDiffEditorModel & IDisposable;

  constructor(private multiDiffWidget: MultiDiffEditorWidget, private convertedOptions: IConvertedMonacoOptions) {
    super();
    this.wrapEditors();
  }

  private wrapEditors() {
    this.collectionService.addMultiDiffEditors([this]);
  }

  @OnEvent(EditorDocumentModelContentChangedEvent)
  onDocModelContentChangedEvent(e: EditorDocumentModelContentChangedEvent) {
    if (!this.currentUri) {
      return;
    }
    // TODO: 目前的设计下，不支持动态修改 resource 的 name，diff 数量变化时会有问题
    if (
      this.multiDiffModel?.documents.value === 'loading' ||
      !this.multiDiffModel.documents.value.some(
        (document) => document.object.modified?.uri.toString() === e.payload.uri.codeUri.toString(),
      )
    ) {
      return;
    }
    this.eventBus.fire(
      new ResourceDecorationNeedChangeEvent({
        uri: this.currentUri,
        decoration: {
          dirty: !!e.payload.dirty,
          readOnly: !!e.payload.readonly,
        },
      }),
    );
  }

  private saveViewState(uri: URI) {
    if (!uri) {
      return;
    }
    const key = uri.toString();
    const state = this.multiDiffWidget.getViewState();
    if (state) {
      this.viewStateMap.set(key, state);
    }
  }

  private restoreViewState(uri: URI) {
    if (!uri) {
      return;
    }
    const key = uri.toString();
    const state = this.viewStateMap.get(key);
    if (state) {
      this.multiDiffWidget.setViewState(state);
    }
  }

  async compareMultiple(editor: IMultiDiffEditor, resource: IResource, options?: IResourceOpenOptions): Promise<void> {
    // Save current view state before changing
    if (this.currentUri) {
      this.saveViewState(this.currentUri);
    }

    const source: IResolvedMultiDiffSource | undefined = resource.metadata.sources?.length
      ? { resources: ValueWithChangeEvent.const(resource.metadata.sources) }
      : await this.multiDiffSourceResolverService.resolve(resource.uri);
    const resources = source ? observableFromValueWithChangeEvent(this, source.resources) : constObservable([]);

    const documentsWithPromises = mapObservableArrayCached(
      this,
      resources,
      async (r, store) => {
        /** @description documentsWithPromises */
        let original: IEditorDocumentModelRef | undefined;
        let modified: IEditorDocumentModelRef | undefined;

        const multiDiffItemStore = new DisposableStore();

        try {
          [original, modified] = await Promise.all([
            r.originalUri ? this.documentModelManager.createModelReference(r.originalUri) : undefined,
            r.modifiedUri ? this.documentModelManager.createModelReference(r.modifiedUri) : undefined,
          ]);
          if (original) {
            multiDiffItemStore.add(original);
          }
          if (modified) {
            multiDiffItemStore.add(modified);
          }
        } catch (e) {
          // e.g. "File seems to be binary and cannot be opened as text"
          this.messageService.error(e.message);
          this.logger.error(e);
          return undefined;
        }
        const uri = (r.modifiedUri ?? r.originalUri)!;
        const result = {
          multiDiffEditorItem: r,
          original: original?.instance.getMonacoModel(),
          modified: modified?.instance.getMonacoModel(),
          originalInstance: original?.instance,
          modifiedInstance: modified?.instance,
          contextKeys: r.contextKeys,
          options: {
            readOnly: modified?.instance.readonly,
            // TODO: codelens，wordWrap options
            ...this.convertedOptions.diffOptions,
          },
          // TODO: 监听配置变化验证
          onOptionsDidChange: (h) =>
            this.preferenceService.onPreferenceChanged((e) => {
              if (e.affects(uri.toString()) && e.preferenceName.includes('editor')) {
                h();
              }
            }),
        };
        return store.add(RefCounted.createOfNonDisposable(result, multiDiffItemStore, this));
      },
      (i) => JSON.stringify([i.modifiedUri?.toString(), i.originalUri?.toString()]),
    );

    const documents = observableValue<readonly RefCounted<IDocumentDiffItem>[] | 'loading'>('documents', 'loading');

    const updateDocuments = derived(async (reader) => {
      /** @description Update documents */
      const docsPromises = documentsWithPromises.read(reader);
      const docs = await Promise.all(docsPromises);
      const newDocuments = docs.filter((item) => item !== undefined);
      documents.set(newDocuments, undefined);
    });

    const a = recomputeInitiallyAndOnChange(updateDocuments);
    await updateDocuments.get();
    this.multiDiffModel?.dispose();
    this.multiDiffModel = {
      dispose: () => a.dispose(),
      documents: new ValueWithChangeEventFromObservable(documents),
      contextKeys: source?.contextKeys,
    };

    const viewModel = this.multiDiffWidget.createViewModel(this.multiDiffModel);
    await viewModel.waitForDiffs();
    this.multiDiffWidget.setViewModel(viewModel);
    this.multiDiffWidget.getActiveControl();

    // Update current URI and restore view state
    this.currentUri = resource.uri;
    this.restoreViewState(resource.uri);
    const documentRefs = documents.get();
    for (const ref of documentRefs) {
      if (isString(ref)) {
        continue;
      }
      const modified = ref.object.modified;
      const original = ref.object.original;
      if (!modified || !original) {
        continue;
      }
      const modifiedEditor = this.multiDiffWidget.tryGetCodeEditor(modified?.uri);
      const originalEditor = this.multiDiffWidget.tryGetCodeEditor(original?.uri);
      const modifiedDiffEditorPart = this.injector.get(DiffEditorPart, [
        modifiedEditor?.editor,
        () => (ref.object as any).modifiedInstance,
        EditorType.MODIFIED_DIFF,
      ]);

      const originalDiffEditorPart = this.injector.get(DiffEditorPart, [
        originalEditor?.editor,
        () => (ref.object as any).originalInstance,
        EditorType.ORIGINAL_DIFF,
      ]);
      this.collectionService.addEditors([modifiedDiffEditorPart, originalDiffEditorPart]);
    }
    this.multiDiffModelChangeEmitter.fire(this.multiDiffModel);
  }

  getDiffEntry(uri: URI): IDocumentDiffItem | undefined {
    return this.multiDiffWidget.findDocumentDiffItem(uri.codeUri);
  }

  getCurrentDiffEntry(): IDocumentDiffItem | undefined {
    const activeControl = this.multiDiffWidget.getActiveControl();
    if (!activeControl) {
      return undefined;
    }
    const originalUri = activeControl.getOriginalEditor().getModel()?.uri;
    if (!originalUri) {
      return undefined;
    }
    return this.multiDiffWidget.findDocumentDiffItem(originalUri);
  }

  reveal(resource: IMultiDiffResourceId, options?: { range?: Range; highlight: boolean }): void {
    this.multiDiffWidget.reveal(resource, options);
  }

  /**
   * Collapses all diff entries by updating the viewState
   */
  collapseAll(): void {
    const currentState = this.multiDiffWidget.getViewState();
    const newState = {
      ...currentState,
      docStates: Object.keys(currentState.docStates || {}).reduce(
        (acc, key) => {
          acc[key] = {
            ...currentState.docStates![key],
            collapsed: true,
          };
          return acc;
        },
        {} as Record<
          string,
          {
            collapsed: boolean;
            selections?: ISelection[];
          }
        >,
      ),
    };
    this.multiDiffWidget.setViewState(newState);
  }

  /**
   * Expands all diff entries by updating the viewState
   */
  expandAll(): void {
    const currentState = this.multiDiffWidget.getViewState();
    const newState = {
      ...currentState,
      docStates: Object.keys(currentState.docStates || {}).reduce(
        (acc, key) => {
          acc[key] = {
            ...currentState.docStates![key],
            collapsed: false,
          };
          return acc;
        },
        {} as Record<
          string,
          {
            collapsed: boolean;
            selections?: ISelection[];
          }
        >,
      ),
    };
    this.multiDiffWidget.setViewState(newState);
  }

  layout(dimension: Dimension): void {
    this.multiDiffWidget.layout(dimension);
  }

  focus(): void {
    const activeControl = this.multiDiffWidget.getActiveControl();
    if (activeControl) {
      activeControl.focus();
    }
  }

  tryGetCodeEditor(uri: URI): { diffEditor: IDiffEditor; editor: ICodeEditor } | undefined {
    return this.multiDiffWidget.tryGetCodeEditor(uri.codeUri);
  }

  dispose(): void {
    super.dispose();
    this.multiDiffWidget.dispose();
  }
}
