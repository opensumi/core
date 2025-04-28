import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Disposable, DisposableStore, Emitter, IDisposable, URI } from '@opensumi/ide-core-common';
import {
  ValueWithChangeEventFromObservable,
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

import { IEditorDocumentModelRef } from '../../common/editor';
import { IMultiFileDiffEditor, MultiDiffEditorItem } from '../../common/multi-file-diff';
import { IEditorDocumentModelService } from '../doc-model/types';
import { IConvertedMonacoOptions } from '../types';

export class BrowserMultiFileDiffEditor extends Disposable implements IMultiFileDiffEditor {
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  @Autowired(IMessageService)
  private readonly messageService: IMessageService;

  @Autowired(IEditorDocumentModelService)
  documentModelManager: IEditorDocumentModelService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private _onRefOpen = new Emitter<IEditorDocumentModelRef>();
  public readonly onRefOpen = this._onRefOpen.event;

  private _onCurrentDiffEntryChange = new Emitter<IDocumentDiffItem | undefined>();
  public readonly onCurrentDiffEntryChange = this._onCurrentDiffEntryChange.event;

  private _onDiffEntriesChange = new Emitter<IDocumentDiffItem[]>();
  public readonly onDiffEntriesChange = this._onDiffEntriesChange.event;

  constructor(private multiDiffWidget: MultiDiffEditorWidget, private convertedOptions: IConvertedMonacoOptions) {
    super();
  }

  async compareMultiple(diffItems: MultiDiffEditorItem[]): Promise<void> {
    // TODO: 得用observer包一下才行，这个监听逻辑是啥？
    // const model: IMultiDiffEditorModel = {
    //   documents: diffItems,
    // };
    // TODO: 监听传入resources数量变化，修改title？这个sources应该和 URI 有一个关联关系在的
    const source = { resources: observableFromValueWithChangeEvent(this, ValueWithChangeEvent.const(diffItems)) };
    const resources = derived((reader) => source.resources.read(reader));

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
          // eslint-disable-next-line no-console
          console.error(e);
          return undefined;
        }
        // TODO: 目前的实现方式，sources 变化感知不到
        const uri = (r.modifiedUri ?? r.originalUri)!;
        const result = {
          multiDiffEditorItem: r,
          original: original?.instance.getMonacoModel(),
          modified: modified?.instance.getMonacoModel(),
          // contextKeys: r.contextKeys,
          options: {
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

    const _viewModel: IMultiDiffEditorModel & IDisposable = {
      dispose: () => a.dispose(),
      documents: new ValueWithChangeEventFromObservable(documents),
      // contextKeys: source.source?.contextKeys,
    };

    const viewModel = this.multiDiffWidget.createViewModel(_viewModel);
    await viewModel.waitForDiffs();
    // const viewModel = this.multiDiffWidget.createViewModel(model);
    this.multiDiffWidget.setViewModel(viewModel);
    // this._onDiffEntriesChange.fire(diffItems);
  }

  // addComparison(item: IDocumentDiffItem): void {
  //   const currentItems = this.getDiffEntries();
  //   this.compareMultiple([...currentItems, item]);
  // }

  // removeComparison(originalUri: URI, modifiedUri: URI): void {
  //   const currentItems = this.getDiffEntries();
  //   const filteredItems = currentItems.filter(
  //     (item) =>
  //       item.original.uri.toString() !== originalUri.toString() ||
  //       item.modified.uri.toString() !== modifiedUri.toString(),
  //   );
  //   this.compareMultiple(filteredItems);
  // }

  getDiffEntries(): IDocumentDiffItem[] {
    return [];
    // return this.multiDiffWidget.findDocumentDiffItem(new URI(''))?.model.entries || [];
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
    this._onRefOpen.dispose();
    this._onCurrentDiffEntryChange.dispose();
    this._onDiffEntriesChange.dispose();
  }
}
