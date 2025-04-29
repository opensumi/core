import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Disposable, DisposableStore, Emitter, IDisposable, URI } from '@opensumi/ide-core-common';
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

import { IEditorDocumentModelRef, IResourceOpenOptions } from '../../common/editor';
import { IMultiDiffEditor, IMultiDiffSourceResolverService, IResolvedMultiDiffSource } from '../../common/multi-diff';
import { IEditorDocumentModelService } from '../doc-model/types';
import { IConvertedMonacoOptions, IResource } from '../types';

@Injectable({ multiple: true })
export class BrowserMultiDiffEditor extends Disposable implements IMultiDiffEditor {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(IEditorDocumentModelService)
  documentModelManager: IEditorDocumentModelService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IMultiDiffSourceResolverService)
  private readonly multiDiffSourceResolverService: IMultiDiffSourceResolverService;

  private multiDiffModelChangeEmitter = new Emitter<IMultiDiffEditorModel>();
  public readonly onMultiDiffModelChange = this.multiDiffModelChangeEmitter.event;

  private viewStateMap: Map<string, any> = new Map();
  private currentUri: URI | undefined;

  constructor(private multiDiffWidget: MultiDiffEditorWidget, private convertedOptions: IConvertedMonacoOptions) {
    super();
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

  async compareMultiple(resource: IResource, options?: IResourceOpenOptions): Promise<void> {
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
          // console.log('original', original, 'modified', modified);
          if (original) {
            multiDiffItemStore.add(original);
          }
          if (modified) {
            multiDiffItemStore.add(modified);
          }
        } catch (e) {
          // e.g. "File seems to be binary and cannot be opened as text"
          this.messageService.error(e.message);
          // eslint-disable-next-line no-console
          console.error(e);
          return undefined;
        }
        const uri = (r.modifiedUri ?? r.originalUri)!;
        const result = {
          multiDiffEditorItem: r,
          original: original?.instance.getMonacoModel(),
          modified: modified?.instance.getMonacoModel(),
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
    const multiDiffModel: IMultiDiffEditorModel & IDisposable = {
      dispose: () => a.dispose(),
      documents: new ValueWithChangeEventFromObservable(documents),
      contextKeys: source?.contextKeys,
    };

    const viewModel = this.multiDiffWidget.createViewModel(multiDiffModel);
    await viewModel.waitForDiffs();
    this.multiDiffWidget.setViewModel(viewModel);

    // Update current URI and restore view state
    this.currentUri = resource.uri;
    this.restoreViewState(resource.uri);

    this.multiDiffModelChangeEmitter.fire(multiDiffModel);
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

// TODO: dirty
// function isUriDirty(onDidChangeDirty: FastEventDispatcher<ITextFileEditorModel, URI>, textFileService: ITextFileService, uri: URI) {
// 	return observableFromEvent(onDidChangeDirty.filteredEvent(uri), () => textFileService.isDirty(uri));
// }
