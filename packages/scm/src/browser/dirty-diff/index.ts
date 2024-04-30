import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  Disposable,
  DisposableCollection,
  DisposableStore,
  Event,
  KeybindingRegistry,
} from '@opensumi/ide-core-browser';
import { CommandService, IEventBus } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  EditorGroupChangeEvent,
  EditorOpenType,
  IEditorDocumentModel,
  IEditorFeatureRegistry,
} from '@opensumi/ide-editor/lib/browser';
import { ISumiEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import * as monaco from '@opensumi/ide-monaco';
import { monacoBrowser } from '@opensumi/ide-monaco/lib/browser';

import { CLOSE_DIRTY_DIFF_WIDGET, IDirtyDiffWorkbenchController } from '../../common';
import { SCMPreferences } from '../scm-preference';

import { DirtyDiffDecorator } from './dirty-diff-decorator';
import { DirtyDiffModel, isDirtyDiffVisible } from './dirty-diff-model';
import { DirtyDiffWidget } from './dirty-diff-widget';

import type { ICodeEditor as IMonacoCodeEditor, ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import './dirty-diff.module.less';

export class DirtyDiffItem {
  constructor(readonly model: DirtyDiffModel, readonly decorator: DirtyDiffDecorator) {}

  dispose(): void {
    this.decorator.dispose();
    this.model.dispose();
  }
}

@Injectable()
export class DirtyDiffWorkbenchController extends Disposable implements IDirtyDiffWorkbenchController {
  private enabled = false;
  private models: IEditorDocumentModel[] = [];
  private widgets = new Map<string, DirtyDiffWidget>();
  private items: { [modelId: string]: DirtyDiffItem } = Object.create(null);
  private readonly transientDisposables = new DisposableStore();

  @Autowired(SCMPreferences)
  private readonly scmPreferences: SCMPreferences;

  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorService;

  @Autowired(IEditorFeatureRegistry)
  private readonly editorFeatureRegistry: IEditorFeatureRegistry;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(KeybindingRegistry)
  protected readonly keybindingRegistry: KeybindingRegistry;

  constructor() {
    super();

    this.keybindingRegistry.registerKeybinding({
      command: CLOSE_DIRTY_DIFF_WIDGET.id,
      keybinding: 'esc',
      when: isDirtyDiffVisible.equalsTo(true),
    });
  }

  public start() {
    const onDidChangeConfiguration = Event.filter(this.scmPreferences.onPreferenceChanged, (e) =>
      e.affects('scm.diffDecorations'),
    );
    this.addDispose(onDidChangeConfiguration(this.onDidChangeConfiguration, this));
    this.onDidChangeConfiguration();

    const onDidChangeDiffWidthConfiguration = Event.filter(this.scmPreferences.onPreferenceChanged, (e) =>
      e.affects('scm.diffDecorationsGutterWidth'),
    );
    onDidChangeDiffWidthConfiguration(this.onDidChangeDiffWidthConfiguration, this);
    this.onDidChangeDiffWidthConfiguration();

    this.addDispose(
      this.editorFeatureRegistry.registerEditorFeatureContribution({
        contribute: (editor) => this.attachEvents(editor.monacoEditor),
      }),
    );

    this.addDispose(
      this.scmPreferences.onPreferenceChanged((event) => {
        if (event.preferenceName === 'scm.alwaysShowDiffWidget' && event.newValue === false) {
          this.widgets.forEach((widget) => {
            widget.dispose();
          });
        }
      }),
    );
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
  }

  private enable(): void {
    if (this.enabled) {
      this.disable();
    }

    this.transientDisposables.add(
      this.eventBus.on(EditorGroupChangeEvent, () => {
        this.onEditorsChanged();
      }),
    );
    this.onEditorsChanged();
    this.enabled = true;
  }

  private disable(): void {
    if (!this.enabled) {
      return;
    }

    this.transientDisposables.clear();
    this.models.forEach((m) => {
      const item = this.items[m.id];
      if (item) {
        item.dispose();
      }
    });
    this.models = [];
    this.items = Object.create(null);
    this.enabled = false;
  }

  // HACK: This is the best current way of figuring out whether to draw these decorations
  // or not. Needs context from the editor, to know whether it is a diff editor, in place editor
  // etc.
  private onEditorsChanged(): void {
    // todo: sth like activeTextEditors is needed here @taian.lta @kengtou
    const models = this.editorService.editorGroups

      // only interested in code editor widgets
      .filter((editorGroup) => editorGroup.currentOpenType && editorGroup.currentOpenType.type === EditorOpenType.code)
      // set model registry and map to models
      .map((editorGroup) => {
        const currentEditor = editorGroup.currentEditor as ISumiEditor;
        if (currentEditor) {
          // const codeEditor = currentEditor.monacoEditor;
          // const controller = DirtyDiffController.get(codeEditor);
          // controller.modelRegistry = this;
          return currentEditor.currentDocumentModel;
        }
        return null;
      })

      // remove nulls and duplicates
      .filter((m, i, a) => !!m && !!m.uri && a.indexOf(m, i + 1) === -1) as IEditorDocumentModel[];

    const newModels = models.filter((o) => this.models.every((m) => o !== m));
    const oldModels = this.models.filter((m) => models.every((o) => o !== m));

    oldModels.forEach((m) => this.onModelInvisible(m));
    newModels.forEach((m) => this.onModelVisible(m));

    this.models = models;
  }

  private onModelVisible(editorModel: IEditorDocumentModel): void {
    const model = this.injector.get(DirtyDiffModel, [editorModel]);
    const decorator = this.injector.get(DirtyDiffDecorator, [editorModel, model]);

    this.items[editorModel.id] = new DirtyDiffItem(model, decorator);
  }

  private onModelInvisible(editorModel: IEditorDocumentModel): void {
    this.items[editorModel.id].dispose();
    delete this.items[editorModel.id];
  }

  public closeDirtyDiffWidget(codeEditor: IMonacoCodeEditor) {
    const widget = this.widgets.get(codeEditor.getId());
    if (widget) {
      widget.dispose();
    }
  }

  public toggleDirtyDiffWidget(codeEditor: IMonacoCodeEditor, position: monaco.IPosition) {
    const model = codeEditor.getModel();
    if (model && position) {
      let widget = this.widgets.get(codeEditor.getId());
      const dirtyModel = this.getModel(model);
      if (dirtyModel) {
        if (widget) {
          const { currentIndex } = widget;
          const { count: targetIndex } = dirtyModel.getChangeFromRange(monaco.positionToRange(position));

          widget.dispose();
          if (currentIndex === targetIndex) {
            return;
          }
        }

        // 每次都创建一个新的 widget
        widget = new DirtyDiffWidget(codeEditor, dirtyModel, this.commandService);
        widget.onDispose(() => {
          this.widgets.delete(codeEditor.getId());
        });
        dirtyModel.onClickDecoration(widget, monaco.positionToRange(position));
        this.widgets.set(codeEditor.getId(), widget);
      }
    }
  }

  private _doMouseDown(codeEditor: IMonacoCodeEditor, { target }: monaco.editor.IEditorMouseEvent) {
    if (!target) {
      return;
    }

    const { position, type, element } = target;
    if (
      type === monacoBrowser.editor.MouseTargetType.GUTTER_LINE_DECORATIONS &&
      element &&
      element.className.indexOf('dirty-diff-glyph') > -1 &&
      position
    ) {
      const offsetLeftInGutter = (element as HTMLElement).offsetLeft;
      const gutterOffsetX = target.detail.offsetX - offsetLeftInGutter;

      /**
       * 这段逻辑来自于 vscode 的源代码，由于 folding 的 icon 和 decorations 是父子关系，
       * 而且 folding 的事件是通过 decorations 的 dom 事件转发过去的，
       * 无法通过事件 target 来区分事件源，vscode 通过点击的 px 像素差来解决这个问题的。
       */
      if (gutterOffsetX < 5) {
        this.toggleDirtyDiffWidget(codeEditor, position);
      } else {
        const widget = this.widgets.get(codeEditor.getId());
        if (widget) {
          widget.dispose();
          this.widgets.delete(codeEditor.getId());
        }
      }
    }
  }

  private attachEvents(codeEditor: IMonacoCodeEditor) {
    const disposeCollection = new DisposableCollection();

    disposeCollection.push(
      codeEditor.onMouseDown((event) => {
        if (this.scmPreferences['scm.alwaysShowDiffWidget']) {
          this._doMouseDown(codeEditor, event);
        }
      }),
    );

    disposeCollection.push(
      codeEditor.onDidChangeModel(({ oldModelUrl }) => {
        if (oldModelUrl) {
          const oldWidget = this.widgets.get(codeEditor.getId());
          if (oldWidget) {
            oldWidget.dispose();
          }
        }
      }),
    );

    disposeCollection.push(
      codeEditor.onDidDispose(() => {
        disposeCollection.dispose();
      }),
    );
    return disposeCollection;
  }

  private getModel(editorModel: ITextModel): DirtyDiffModel | null {
    const item = this.items[editorModel.id];

    if (!item) {
      return null;
    }

    return item.model;
  }

  dispose(): void {
    this.disable();

    this.widgets.forEach((widget) => widget.dispose());
    this.widgets.clear();

    super.dispose();
  }
}
