import debounce = require('lodash.debounce');

import { Injectable, Autowired, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { WithEventBus, MaybeNull, IRange, ILineChange, URI, ISelection } from '@opensumi/ide-core-common';
import {
  WorkbenchEditorService,
  IEditorGroup,
  IResource,
  IUndoStopOptions,
  ISingleEditOperation,
  IDecorationApplyOptions,
  IEditorOpenType,
  IResourceOpenOptions,
  EditorCollectionService,
  IDecorationRenderOptions,
  IThemeDecorationRenderOptions,
} from '@opensumi/ide-editor';
import {
  EditorGroupChangeEvent,
  IEditorDecorationCollectionService,
  EditorSelectionChangeEvent,
  EditorVisibleChangeEvent,
  EditorConfigurationChangedEvent,
  EditorGroupIndexChangedEvent,
  IDiffResource,
} from '@opensumi/ide-editor/lib/browser';
import {
  IMonacoImplEditor,
  EditorCollectionServiceImpl,
  BrowserDiffEditor,
} from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import type { ICodeEditor as IMonacoCodeEditor, ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { EndOfLineSequence } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';
import { RenderLineNumbersType } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { StaticServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import {
  IMainThreadEditorsService,
  IExtensionHostEditorService,
  ExtHostAPIIdentifier,
  IEditorChangeDTO,
  IResolvedTextEditorConfiguration,
  TextEditorRevealType,
  ITextEditorUpdateConfiguration,
  TextEditorCursorStyle,
} from '../../../common/vscode';
import { viewColumnToResourceOpenOptions } from '../../../common/vscode/converter';

import { MainThreadExtensionDocumentData } from './main.thread.doc';


@Injectable({ multiple: true })
export class MainThreadEditorService extends WithEventBus implements IMainThreadEditorsService {
  @Autowired(WorkbenchEditorService)
  private readonly editorService: WorkbenchEditorServiceImpl;

  @Autowired(IEditorDecorationCollectionService)
  private readonly decorationService: IEditorDecorationCollectionService;

  @Autowired(EditorCollectionService)
  private readonly codeEditorService: EditorCollectionServiceImpl;

  @Autowired(StaticResourceService)
  staticResourceService: StaticResourceService;

  private readonly proxy: IExtensionHostEditorService;

  constructor(
    @Optional(Symbol()) private rpcProtocol: IRPCProtocol,
    private documents: MainThreadExtensionDocumentData,
  ) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEditors);
    this.$getInitialState().then((change) => {
      this.proxy.$acceptChange(change);
    });
  }

  async $getInitialState() {
    this.startEvents();
    const editors = this.editorService.editorGroups
      .map((group) => {
        if (group.currentOpenType && isEditor(group.currentOpenType)) {
          const editor = group.currentEditor as IMonacoImplEditor;
          if (!editor.currentDocumentModel) {
            return undefined;
          }
          if (!this.documents.isDocSyncEnabled(editor.currentDocumentModel.uri)) {
            return undefined;
          }
          return {
            id: getTextEditorId(group, group.currentResource!.uri),
            uri: editor.currentDocumentModel.uri.toString(),
            selections: editor!.getSelections() || [],
            options: getEditorOption(editor.monacoEditor),
            viewColumn: getViewColumn(group),
            visibleRanges: editor.monacoEditor.getVisibleRanges(),
          };
        }
      })
      .filter((c) => !!c);
    const activedEditor =
      this.editorService.currentResource &&
      editors.find((e) => e!.uri === this.editorService.currentResource!.uri.toString());
    return {
      created: editors,
      actived: activedEditor && this.documents.isDocSyncEnabled(activedEditor.uri) && activedEditor.id,
    } as IEditorChangeDTO;
  }

  async $closeEditor(id: string) {
    const editor = this.getEditor(id);
    if (editor) {
      const group = this.getGroup(id)!;
      group.close(group.currentResource!.uri);
    }
  }

  async $revealRange(id: string, range: IRange, type?: TextEditorRevealType) {
    const editor = this.getEditor(id);
    if (editor) {
      switch (type) {
        case TextEditorRevealType.InCenter:
          return editor.monacoEditor.revealRangeInCenter(range);
        case TextEditorRevealType.AtTop:
          return editor.monacoEditor.revealRangeAtTop(range);
        case TextEditorRevealType.InCenterIfOutsideViewport:
          return editor.monacoEditor.revealRangeInCenterIfOutsideViewport(range);
        default:
          return editor.monacoEditor.revealRange(range);
      }
    }
  }

  async $createTextEditorDecorationType(key, options: IDecorationRenderOptions) {
    this.resolveIconPaths(options);
    this.resolveIconPaths(options.dark);
    this.resolveIconPaths(options.light);
    this.decorationService.createTextEditorDecorationType(options, key);
  }

  private resolveIconPaths(options?: IThemeDecorationRenderOptions) {
    if (!options) {
      return options;
    }
    if (options.gutterIconPath) {
      let uri: URI;
      if (typeof options.gutterIconPath === 'string') {
        uri = URI.file(options.gutterIconPath);
      } else {
        uri = URI.from(options.gutterIconPath);
      }
      options.gutterIconPath = this.staticResourceService.resolveStaticResource(uri).toString();
    }
  }

  async $deleteTextEditorDecorationType(key) {
    const type = this.decorationService.getTextEditorDecorationType(key);
    if (type) {
      type.dispose();
    }
  }

  async $applyDecoration(id: string, decorationKey: string, options: IDecorationApplyOptions[]) {
    const editor = this.getEditor(id);
    if (editor) {
      editor.applyDecoration(decorationKey, options);
    }
  }

  async $insertSnippet(
    id: string,
    snippet: string,
    ranges: IRange[] = [],
    options: IUndoStopOptions = { undoStopAfter: true, undoStopBefore: true },
  ) {
    const editor = this.getEditor(id);
    if (editor) {
      editor.insertSnippet(snippet, ranges, options);
    }
  }

  async $updateOptions(id: string, update: ITextEditorUpdateConfiguration) {
    const editor = this.getEditor(id);
    if (editor) {
      await this.setConfiguration(editor.monacoEditor, update);
    }
  }

  private getEditor(id: string): IMonacoImplEditor | undefined {
    const group = this.getGroup(id);
    if (!group) {
      return;
    }
    const currentResource = group.currentResource;
    if (currentResource && group.currentOpenType && isEditor(group.currentOpenType)) {
      if (id === getTextEditorId(group, currentResource.uri)) {
        return group.currentEditor as IMonacoImplEditor;
      }
      if (
        group.currentOpenType?.type === 'diff' &&
        id === getTextEditorId(group, (currentResource as IDiffResource).metadata!.original, true)
      ) {
        return group.diffEditor.originalEditor;
      }
    }
  }

  private getGroup(id: string): IEditorGroup | undefined {
    const groupId = getGroupIdFromTextEditorId(id);
    const group = this.editorService.getEditorGroup(groupId);
    return group;
  }

  startEvents() {
    this.addDispose(
      this.eventBus.on(EditorGroupChangeEvent, (event) => {
        const payload = event.payload;
        if (
          !resourceEquals(payload.newResource, payload.oldResource) ||
          !openTypeEquals(payload.newOpenType, payload.oldOpenType)
        ) {
          const change: IEditorChangeDTO = {};
          if (payload.newOpenType && (payload.newOpenType.type === 'code' || payload.newOpenType.type === 'diff')) {
            const editor = payload.group.currentEditor as IMonacoImplEditor;
            if (!editor.currentDocumentModel) {
              // noop
            } else if (!this.documents.isDocSyncEnabled(editor.currentDocumentModel.uri)) {
              // noop
            } else {
              change.created = [
                {
                  id: getTextEditorId(payload.group, payload.newResource!.uri),
                  uri: editor.currentDocumentModel!.uri.toString(),
                  selections: editor!.getSelections() || [],
                  options: getEditorOption(editor.monacoEditor),
                  viewColumn: getViewColumn(payload.group),
                  visibleRanges: editor.monacoEditor.getVisibleRanges(),
                },
              ];
              if (payload.newOpenType.type === 'diff') {
                const diffOriginalEditor = payload.group.diffEditor.originalEditor;
                change.created.push({
                  id: getTextEditorId(payload.group, (payload.newResource as IDiffResource).metadata!.original, true),
                  uri: diffOriginalEditor.currentUri!.toString(),
                  selections: diffOriginalEditor!.getSelections() || [],
                  options: getEditorOption(diffOriginalEditor.monacoEditor),
                  viewColumn: getViewColumn(payload.group),
                  visibleRanges: diffOriginalEditor.monacoEditor.getVisibleRanges(),
                });
              }
            }
            // 来自切换打开类型
            if (
              resourceEquals(payload.newResource, payload.oldResource) &&
              !openTypeEquals(payload.newOpenType, payload.oldOpenType) &&
              payload.newResource === this.editorService.currentResource
            ) {
              change.actived = getTextEditorId(payload.group, payload.newResource!.uri);
            }
          }
          if (payload.oldOpenType && (payload.oldOpenType.type === 'code' || payload.oldOpenType.type === 'diff')) {
            change.removed = [getTextEditorId(payload.group, payload.oldResource!.uri)];
            if (payload.oldOpenType.type === 'diff') {
              change.removed.push(
                getTextEditorId(payload.group, (payload.oldResource as IDiffResource).metadata!.original, true),
              );
            }
          }
          this.proxy.$acceptChange(change);
        }
      }),
    );

    this.addDispose(
      this.editorService.onActiveEditorUriChange((uri) => {
        if (
          uri &&
          this.editorService.currentEditorGroup &&
          isEditor(this.editorService.currentEditorGroup.currentOpenType)
        ) {
          const isDiffOriginal =
            this.editorService.currentEditorGroup.currentOpenType?.type === 'diff' &&
            this.editorService.currentEditorGroup.diffEditor.originalEditor.currentUri?.isEqual(uri);
          if (isDiffOriginal) {
            this.proxy.$acceptChange({
              actived: getTextEditorId(this.editorService.currentEditorGroup, uri, true),
            });
          } else {
            // 这里 id 还是兼容旧逻辑不做改动
            this.proxy.$acceptChange({
              actived: getTextEditorId(
                this.editorService.currentEditorGroup,
                this.editorService.currentEditorGroup.currentResource?.uri!,
              ),
            });
          }
        } else {
          this.proxy.$acceptChange({
            actived: '-1',
          });
        }
      }),
    );

    const selectionChange = (e: EditorSelectionChangeEvent) => {
      const editorId = getTextEditorId(e.payload.group, e.payload.resource.uri);
      this.proxy.$acceptPropertiesChange({
        id: editorId,
        selections: {
          selections: e.payload.selections,
          source: e.payload.source,
        },
      });
    };

    const debouncedSelectionChange = debounce((e) => selectionChange(e), 50, {
      maxWait: 200,
      leading: true,
      trailing: true,
    });

    this.addDispose(
      this.eventBus.on(EditorSelectionChangeEvent, (e) => {
        if (e.payload.source === 'mouse') {
          debouncedSelectionChange(e);
        } else {
          debouncedSelectionChange.cancel();
          selectionChange(e);
        }
      }),
    );

    this.addDispose(
      this.eventBus.on(
        EditorVisibleChangeEvent,
        debounce(
          (e: EditorVisibleChangeEvent) => {
            const editorId = getTextEditorId(e.payload.group, e.payload.resource.uri);
            this.proxy.$acceptPropertiesChange({
              id: editorId,
              visibleRanges: e.payload.visibleRanges,
            });
          },
          50,
          { maxWait: 200, leading: true, trailing: true },
        ),
      ),
    );
    this.addDispose(
      this.eventBus.on(EditorConfigurationChangedEvent, (e: EditorConfigurationChangedEvent) => {
        const editorId = getTextEditorId(e.payload.group, e.payload.resource.uri);
        if (
          e.payload.group.currentEditor &&
          (e.payload.group.currentEditor as IMonacoImplEditor).monacoEditor.getModel()
        ) {
          this.proxy.$acceptPropertiesChange({
            id: editorId,
            options: getEditorOption((e.payload.group.currentEditor as IMonacoImplEditor).monacoEditor),
          });
        }
      }),
    );
    this.addDispose(
      this.eventBus.on(EditorGroupIndexChangedEvent, (e) => {
        if (isGroupEditorState(e.payload.group)) {
          const editorId = getTextEditorId(e.payload.group, e.payload.group.currentResource!.uri);
          this.proxy.$acceptPropertiesChange({
            id: editorId,
            viewColumn: getViewColumn(e.payload.group),
          });
        }
      }),
    );
  }

  async $applyEdits(
    id: string,
    documentVersionId: number,
    edits: ISingleEditOperation[],
    options: { setEndOfLine: EndOfLineSequence | undefined; undoStopBefore: boolean; undoStopAfter: boolean },
  ): Promise<boolean> {
    const editor = this.getEditor(id);
    if (editor && editor.currentDocumentModel) {
      const model: ITextModel = editor.currentDocumentModel.getMonacoModel();
      if (model && model.getVersionId() === documentVersionId) {
        if (typeof options.setEndOfLine !== 'undefined') {
          model.pushEOL(options.setEndOfLine as any);
        }
        const transformedEdits = edits.map(
          (edit): monaco.editor.IIdentifiedSingleEditOperation => ({
            range: monaco.Range.lift(edit.range)!,
            text: edit.text,
            forceMoveMarkers: edit.forceMoveMarkers,
          }),
        );
        if (options.undoStopBefore) {
          editor.monacoEditor.pushUndoStop();
        }
        editor.monacoEditor.executeEdits('MainThreadTextEditor', transformedEdits);
        if (options.undoStopAfter) {
          editor.monacoEditor.pushUndoStop();
        }
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  async $openResource(uri: string, options: IResourceOpenOptions): Promise<string> {
    options.forceOpenType = { type: 'code' };
    options.focus = true;
    options = {
      ...options,
      ...viewColumnToResourceOpenOptions((options as any).viewColumn),
    };
    const result = await this.editorService.open(new URI(uri), options);
    if (result) {
      return getTextEditorId(result.group, result.resource.uri);
    }
    throw new Error('Editor Open uri ' + uri.toString() + ' Failed');
  }

  $setSelections(id: string, selections: ISelection[]): Promise<void> {
    if (!this.getEditor(id)) {
      return Promise.reject(`No Such TextEditor: ${id}`);
    }
    this.getEditor(id)!.setSelections(selections);
    return Promise.resolve();
  }

  public setConfiguration(codeEditor: IMonacoCodeEditor, newConfiguration: ITextEditorUpdateConfiguration): void {
    if (codeEditor.getModel()) {
      this._setIndentConfiguration(codeEditor.getModel()!, newConfiguration);
    }
    if (!codeEditor) {
      return;
    }

    if (newConfiguration.cursorStyle) {
      const newCursorStyle = cursorStyleToString(newConfiguration.cursorStyle);
      codeEditor.updateOptions({
        cursorStyle: newCursorStyle as any,
      });
    }

    if (typeof newConfiguration.lineNumbers !== 'undefined') {
      let lineNumbers: 'on' | 'off' | 'relative';
      switch (newConfiguration.lineNumbers) {
        case RenderLineNumbersType.On:
          lineNumbers = 'on';
          break;
        case RenderLineNumbersType.Relative:
          lineNumbers = 'relative';
          break;
        default:
          lineNumbers = 'off';
      }
      codeEditor.updateOptions({
        lineNumbers,
      });
    }
  }

  $getDiffInformation(id: string): Promise<ILineChange[]> {
    const editor = this.getEditor(id);

    if (!editor) {
      return Promise.reject(new Error('No such TextEditor'));
    }

    const codeEditor = editor.monacoEditor;
    if (!codeEditor) {
      return Promise.reject(new Error('No such CodeEditor'));
    }

    const codeEditorId = codeEditor.getId();

    const diffEditors = this.codeEditorService.listDiffEditors();
    const [diffEditor] = diffEditors.filter(
      (d) => d.originalEditor.getId() === codeEditorId || d.modifiedEditor.getId() === codeEditorId,
    );

    if (diffEditor) {
      return Promise.resolve((diffEditor as BrowserDiffEditor).monacoDiffEditor.getLineChanges() || []);
    }

    const dirtyDiffContribution = codeEditor.getContribution('editor.contrib.dirtydiff');

    if (dirtyDiffContribution) {
      return Promise.resolve((dirtyDiffContribution as any).getChanges());
    }

    return Promise.resolve([]);
  }

  private _setIndentConfiguration(model: ITextModel, newConfiguration: ITextEditorUpdateConfiguration): void {
    const creationOpts = StaticServices.modelService
      .get()
      .getCreationOptions((model as any).getLanguageIdentifier().language, model.uri, (model as any).isForSimpleWidget);

    if (newConfiguration.tabSize === 'auto' || newConfiguration.insertSpaces === 'auto') {
      // one of the options was set to 'auto' => detect indentation
      let insertSpaces = creationOpts.insertSpaces;
      let tabSize = creationOpts.tabSize;

      if (newConfiguration.insertSpaces !== 'auto' && typeof newConfiguration.insertSpaces !== 'undefined') {
        insertSpaces = newConfiguration.insertSpaces;
      }

      if (newConfiguration.tabSize !== 'auto' && typeof newConfiguration.tabSize !== 'undefined') {
        tabSize = newConfiguration.tabSize;
      }

      model.detectIndentation(insertSpaces, tabSize);
      return;
    }

    const newOpts: monaco.editor.ITextModelUpdateOptions = {};
    if (typeof newConfiguration.insertSpaces !== 'undefined') {
      newOpts.insertSpaces = newConfiguration.insertSpaces;
    }
    if (typeof newConfiguration.tabSize !== 'undefined') {
      newOpts.tabSize = newConfiguration.tabSize;
    }
    if (typeof newConfiguration.indentSize !== 'undefined') {
      if (newConfiguration.indentSize === 'tabSize') {
        newOpts.indentSize = newOpts.tabSize || creationOpts.tabSize;
      } else {
        newOpts.indentSize = newConfiguration.indentSize;
      }
    }
    model.updateOptions(newOpts);
  }
}

function getTextEditorId(group: IEditorGroup, uri: URI, isDiffOriginal?: boolean): string {
  return group.name + '.' + (isDiffOriginal ? 'diffOriginal.' : '') + uri.toString();
}

function getGroupIdFromTextEditorId(id: string): string {
  return id.substr(0, id.indexOf('.'));
}

function getEditorOption(editor: IMonacoCodeEditor): IResolvedTextEditorConfiguration {
  const modelOptions = editor.getModel()!.getOptions();
  return {
    tabSize: modelOptions.tabSize,
    indentSize: modelOptions.indentSize,
    insertSpaces: modelOptions.insertSpaces,
    cursorStyle: editor.getOption(monaco.editor.EditorOption.cursorStyle),
    // 这里之前取 lineNumbers 配置项的值，现在改成取 renderType，是为了跟之前保持返回值一致
    lineNumbers: editor.getOption(monaco.editor.EditorOption.lineNumbers).renderType,
  };
}

function isEditor(openType: MaybeNull<IEditorOpenType>): boolean {
  if (!openType) {
    return false;
  }
  return openType.type === 'code' || openType.type === 'diff';
}

function isGroupEditorState(group: IEditorGroup) {
  return group.currentOpenType && isEditor(group.currentOpenType);
}

function getViewColumn(group: IEditorGroup) {
  return group.index + 1;
}

function resourceEquals(r1: MaybeNull<IResource>, r2: MaybeNull<IResource>) {
  if (!r1 && !r2) {
    return true;
  }
  if (r1 && r2 && r1.uri.isEqual(r2.uri)) {
    return true;
  }
  return false;
}

function openTypeEquals(r1: MaybeNull<IEditorOpenType>, r2: MaybeNull<IEditorOpenType>) {
  if (!r1 && !r2) {
    return true;
  }
  if (r1 && r2 && r1.type === r2.type && r1.componentId === r2.componentId) {
    return true;
  }
  return false;
}

export function cursorStyleToString(cursorStyle: TextEditorCursorStyle): string {
  if (cursorStyle === TextEditorCursorStyle.Line) {
    return 'line';
  } else if (cursorStyle === TextEditorCursorStyle.Block) {
    return 'block';
  } else if (cursorStyle === TextEditorCursorStyle.Underline) {
    return 'underline';
  } else if (cursorStyle === TextEditorCursorStyle.LineThin) {
    return 'line-thin';
  } else if (cursorStyle === TextEditorCursorStyle.BlockOutline) {
    return 'block-outline';
  } else if (cursorStyle === TextEditorCursorStyle.UnderlineThin) {
    return 'underline-thin';
  } else {
    throw new Error('cursorStyleToString: Unknown cursorStyle');
  }
}
