import { EditorGroupChangeEvent } from '@ali/ide-editor/lib/browser';
import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { Event, IEventBus } from '@ali/ide-core-common';
import { Disposable, DisposableStore } from '@ali/ide-core-common/lib/disposable';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IMonacoImplEditor } from '@ali/ide-editor/lib/browser/editor-collection.service';
import { PreferenceService } from '@ali/ide-core-browser';

import { SCMPreferences } from '../scm-preference';
import { DirtyDiffModel } from './dirty-diff-model';
import { DirtyDiffDecorator } from './dirty-diff-decorator';
import { DirtyDiffController } from './dirty-diff-controller';

import './dirty-diff.module.less';

class DirtyDiffItem {

  constructor(readonly model: DirtyDiffModel, readonly decorator: DirtyDiffDecorator) { }

  dispose(): void {
    this.decorator.dispose();
    this.model.dispose();
  }
}

@Injectable()
export class DirtyDiffWorkbenchController extends Disposable {

  private enabled = false;
  private models: monaco.editor.ITextModel[] = [];
  private items: { [modelId: string]: DirtyDiffItem; } = Object.create(null);
  private readonly transientDisposables = new DisposableStore();

  @Autowired(SCMPreferences)
  scmPreferences: SCMPreferences;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  constructor() {
    super();
  }

  start() {
    const onDidChangeConfiguration = Event.filter(this.preferenceService.onPreferenceChanged, (e) => e.affects('scm.diffDecorations'));
    this.addDispose(onDidChangeConfiguration(this.onDidChangeConfiguration, this));
    this.onDidChangeConfiguration();

    const onDidChangeDiffWidthConfiguration = Event.filter(this.preferenceService.onPreferenceChanged, (e) => e.affects('scm.diffDecorationsGutterWidth'));
    onDidChangeDiffWidthConfiguration(this.onDidChangeDiffWidthConfiguration, this);
    this.onDidChangeDiffWidthConfiguration();
  }

  private onDidChangeConfiguration() {
    const enabled = this.scmPreferences['scm.diffDecorations'] !== 'none';

    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }

  private onDidChangeDiffWidthConfiguration(): void {
    let width = this.scmPreferences['scm.diffDecorationsGutterWidth'];

    if (isNaN(width) || width <= 0 || width > 5) {
      width = 3;
    }
    // @todo
    // this.stylesheet.innerHTML = `.monaco-editor .dirty-diff-modified,.monaco-editor .dirty-diff-added{border-left-width:${width}px;}`;
  }

  private enable(): void {
    if (this.enabled) {
      this.disable();
    }

    this.transientDisposables.add(this.eventBus.on(EditorGroupChangeEvent, () => {
      this.onEditorsChanged();
    }));
    this.onEditorsChanged();
    this.enabled = true;
  }

  private disable(): void {
    if (!this.enabled) {
      return;
    }

    this.transientDisposables.clear();
    this.models.forEach((m) => this.items[m.id].dispose());
    this.models = [];
    this.items = Object.create(null);
    this.enabled = false;
  }

  // HACK: This is the best current way of figuring out whether to draw these decorations
  // or not. Needs context from the editor, to know whether it is a diff editor, in place editor
  // etc.
  private onEditorsChanged(): void {
    const models = this.editorService.editorGroups

      // only interested in code editor widgets
      .filter((editorGroup) =>  editorGroup.currentOpenType && editorGroup.currentOpenType.type === 'code')
      // set model registry and map to models
      .map((editorGroup) => {
        const currentEditor = editorGroup.currentEditor as IMonacoImplEditor;
        if (currentEditor) {
          const codeEditor = currentEditor.monacoEditor;
          // const controller = DirtyDiffController.get(codeEditor);
          // controller.modelRegistry = this;
          return currentEditor.currentDocumentModel && currentEditor.currentDocumentModel.getMonacoModel();
        }
        return null;
      })

      // remove nulls and duplicates
      .filter((m, i, a) => !!m && !!m.uri && a.indexOf(m, i + 1) === -1) as monaco.editor.ITextModel[];

    const newModels = models.filter((o) => this.models.every((m) => o !== m));
    const oldModels = this.models.filter((m) => models.every((o) => o !== m));

    oldModels.forEach((m) => this.onModelInvisible(m));
    newModels.forEach((m) => this.onModelVisible(m));

    this.models = models;
  }

  private onModelVisible(editorModel: monaco.editor.ITextModel): void {
    const model = this.injector.get(DirtyDiffModel, [editorModel]);
    const decorator = this.injector.get(DirtyDiffDecorator, [editorModel, model]);

    this.items[editorModel.id] = new DirtyDiffItem(model, decorator);
  }

  private onModelInvisible(editorModel: monaco.editor.ITextModel): void {
    this.items[editorModel.id].dispose();
    delete this.items[editorModel.id];
  }

  getModel(editorModel: monaco.editor.ITextModel): DirtyDiffModel | null {
    const item = this.items[editorModel.id];

    if (!item) {
      return null;
    }

    return item.model;
  }

  dispose(): void {
    this.disable();
    super.dispose();
  }
}
