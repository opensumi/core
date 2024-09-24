import merge from 'lodash/merge';
import throttle from 'lodash/throttle';

import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource';
import { ILineChange, IRange, ISelection, MaybeNull, URI, WithEventBus } from '@opensumi/ide-core-common';
import {
  EditorCollectionService,
  IDecorationApplyOptions,
  IDecorationRenderOptions,
  IEditorGroup,
  IEditorOpenType,
  IResource,
  IResourceOpenOptions,
  ISingleEditOperation,
  IThemeDecorationRenderOptions,
  IUndoStopOptions,
  WorkbenchEditorService,
} from '@opensumi/ide-editor';
import {
  EditorConfigurationChangedEvent,
  EditorGroupChangeEvent,
  EditorGroupIndexChangedEvent,
  EditorOpenType,
  EditorSelectionChangeEvent,
  EditorVisibleChangeEvent,
  IDiffResource,
  IEditorDecorationCollectionService,
} from '@opensumi/ide-editor/lib/browser';
import {
  BrowserDiffEditor,
  EditorCollectionServiceImpl,
  ISumiEditor,
} from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import * as monaco from '@opensumi/ide-monaco';
import { EndOfLineSequence } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { RenderLineNumbersType } from '@opensumi/monaco-editor-core/esm/vs/editor/common/config/editorOptions';
import { IModelService } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/model';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';

import {
  ExtHostAPIIdentifier,
  IEditorChangeDTO,
  IEditorStatusChangeDTO,
  IExtensionHostEditorService,
  IMainThreadEditorsService,
  IResolvedTextEditorConfiguration,
  ITextEditorUpdateConfiguration,
  TextEditorCursorStyle,
  TextEditorRevealType,
} from '../../../common/vscode';
import { viewColumnToResourceOpenOptions } from '../../../common/vscode/converter';

import { MainThreadExtensionDocumentData } from './main.thread.doc';

import type { ICodeEditor as IMonacoCodeEditor, ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

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
          const editor = group.currentEditor as ISumiEditor;
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

  async $createTextEditorDecorationType(key: string, options: IDecorationRenderOptions) {
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

  async $deleteTextEditorDecorationType(key: string) {
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

  private getEditor(id: string): ISumiEditor | undefined {
    const group = this.getGroup(id);
    if (!group) {
      return;
    }
    const currentResource = group.currentResource;
    if (currentResource && group.currentOpenType && isEditor(group.currentOpenType)) {
      if (id === getTextEditorId(group, currentResource.uri)) {
        return group.currentEditor as ISumiEditor;
      }
      if (
        group.currentOpenType?.type === EditorOpenType.diff &&
        id === getTextEditorId(group, (currentResource as IDiffResource).metadata!.original, 'original')
      ) {
        return group.diffEditor.originalEditor;
      }

      if (
        group.currentOpenType?.type === EditorOpenType.diff &&
        id === getTextEditorId(group, (currentResource as IDiffResource).metadata!.modified, 'modified')
      ) {
        return group.diffEditor.modifiedEditor;
      }
    }
  }

  private getGroup(id: string): IEditorGroup | undefined {
    const groupId = getGroupIdFromTextEditorId(id);
    const group = this.editorService.getEditorGroup(groupId);
    return group;
  }

  protected propertiesChangeCache = new Map<string, IEditorStatusChangeDTO>();

  triggerPropertiesChange = throttle(
    () => {
      const changes: IEditorStatusChangeDTO[] = [];
      this.propertiesChangeCache.forEach((change) => {
        changes.push(change);
      });
      this.propertiesChangeCache.clear();

      this.proxy.$acceptPropertiesChanges(changes);
    },
    16,
    {
      leading: true,
      trailing: true,
    },
  );

  /**
   * 按 id 缓存 change, 每次 change 都会合并到缓存中，debounce 发送给插件进程
   */
  protected batchPropertiesChanges(change: Partial<IEditorStatusChangeDTO> & { id: string }) {
    const { id } = change;

    let propertiesChange = this.propertiesChangeCache.get(id);
    if (!propertiesChange) {
      propertiesChange = {} as IEditorStatusChangeDTO;
    }

    propertiesChange = merge(propertiesChange, change);
    this.propertiesChangeCache.set(id, propertiesChange);

    this.triggerPropertiesChange();
  }

  startEvents() {
    this.addDispose([
      this.eventBus.on(EditorGroupChangeEvent, (event) => {
        const payload = event.payload;
        if (
          !resourceEquals(payload.newResource, payload.oldResource) ||
          !openTypeEquals(payload.newOpenType, payload.oldOpenType)
        ) {
          const change: IEditorChangeDTO = {};
          if (
            payload.newOpenType &&
            (payload.newOpenType.type === EditorOpenType.code || payload.newOpenType.type === EditorOpenType.diff)
          ) {
            const editor = payload.group.currentEditor as ISumiEditor;
            if (!editor.currentDocumentModel) {
              // noop
            } else if (!this.documents.isDocSyncEnabled(editor.currentDocumentModel.uri)) {
              // noop
            } else {
              change.created = [];
              if (payload.newOpenType.type === EditorOpenType.diff) {
                const diffOriginalEditor = payload.group.diffEditor.originalEditor;
                const diffMorifidedEditor = payload.group.diffEditor.modifiedEditor;

                const originalEditorId = getTextEditorId(
                  payload.group,
                  (payload.newResource as IDiffResource).metadata!.original,
                  'original',
                );
                change.created.push({
                  id: originalEditorId,
                  uri: diffOriginalEditor.currentUri!.toString(),
                  selections: diffOriginalEditor.getSelections() || [],
                  options: getEditorOption(diffOriginalEditor.monacoEditor),
                  viewColumn: getViewColumn(payload.group),
                  visibleRanges: diffOriginalEditor.monacoEditor.getVisibleRanges(),
                });

                const modifiedEditorId = getTextEditorId(
                  payload.group,
                  (payload.newResource as IDiffResource).metadata!.modified,
                  'modified',
                );
                change.created.push({
                  id: modifiedEditorId,
                  uri: diffMorifidedEditor.currentUri!.toString(),
                  selections: diffMorifidedEditor.getSelections() || [],
                  options: getEditorOption(diffMorifidedEditor.monacoEditor),
                  viewColumn: getViewColumn(payload.group),
                  visibleRanges: diffMorifidedEditor.monacoEditor.getVisibleRanges(),
                });
              } else {
                change.created.push({
                  id: getTextEditorId(payload.group, payload.newResource!.uri),
                  uri: editor.currentDocumentModel!.uri.toString(),
                  selections: editor.getSelections() || [],
                  options: getEditorOption(editor.monacoEditor),
                  viewColumn: getViewColumn(payload.group),
                  visibleRanges: editor.monacoEditor.getVisibleRanges(),
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
          if (
            payload.oldOpenType &&
            (payload.oldOpenType.type === EditorOpenType.code || payload.oldOpenType.type === EditorOpenType.diff)
          ) {
            change.removed = [];
            if (payload.oldOpenType.type === EditorOpenType.diff) {
              change.removed.push(
                getTextEditorId(payload.group, (payload.oldResource as IDiffResource).metadata!.original, 'original'),
              );

              change.removed.push(
                getTextEditorId(payload.group, (payload.oldResource as IDiffResource).metadata!.modified, 'modified'),
              );
            } else {
              change.removed = [getTextEditorId(payload.group, payload.oldResource!.uri)];
            }
          }
          this.proxy.$acceptChange(change);
        }
      }),
      this.editorService.onActiveEditorUriChange((uri) => {
        if (
          uri &&
          this.editorService.currentEditorGroup &&
          isEditor(this.editorService.currentEditorGroup.currentOpenType)
        ) {
          this.acceptCurrentEditor(uri);
        } else {
          this.proxy.$acceptChange({
            actived: '-1',
          });
        }
      }),
      this.eventBus.on(EditorConfigurationChangedEvent, (e: EditorConfigurationChangedEvent) => {
        const editorId = getTextEditorId(e.payload.group, e.payload.resource.uri);
        if (e.payload.group.currentEditor && (e.payload.group.currentEditor as ISumiEditor).monacoEditor.getModel()) {
          this.batchPropertiesChanges({
            id: editorId,
            options: getEditorOption((e.payload.group.currentEditor as ISumiEditor).monacoEditor),
          });
        }
      }),
      this.eventBus.on(EditorSelectionChangeEvent, (e) => {
        const editorId = getTextEditorId(e.payload.group, e.payload.editorUri, e.payload.side);

        this.batchPropertiesChanges({
          id: editorId,
          selections: {
            selections: e.payload.selections,
            source: e.payload.source,
          },
        });

        this.acceptCurrentEditor(e.payload.editorUri);
      }),
      this.eventBus.on(EditorVisibleChangeEvent, (e: EditorVisibleChangeEvent) => {
        const editorId = getTextEditorId(e.payload.group, e.payload.resource.uri);
        this.batchPropertiesChanges({
          id: editorId,
          visibleRanges: e.payload.visibleRanges,
        });
      }),
      this.eventBus.on(EditorGroupIndexChangedEvent, (e) => {
        if (isGroupEditorState(e.payload.group)) {
          const editorId = getTextEditorId(e.payload.group, e.payload.group.currentResource!.uri);
          this.batchPropertiesChanges({
            id: editorId,
            viewColumn: getViewColumn(e.payload.group),
          });
        }
      }),
    ]);
  }

  private acceptCurrentEditor(uri: URI) {
    let side: string | undefined;

    const isDiffOriginal =
      this.editorService.currentEditorGroup.currentOpenType?.type === EditorOpenType.diff &&
      this.editorService.currentEditorGroup.diffEditor.originalEditor.currentUri?.isEqual(uri);

    const isDiffMorified =
      this.editorService.currentEditorGroup.currentOpenType?.type === EditorOpenType.diff &&
      this.editorService.currentEditorGroup.diffEditor.modifiedEditor.currentUri?.isEqual(uri);

    if (isDiffOriginal) {
      side = 'original';
    }

    if (isDiffMorified) {
      side = 'modified';
    }

    if (side) {
      this.proxy.$acceptChange({
        actived: getTextEditorId(this.editorService.currentEditorGroup, uri, side),
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
    options.forceOpenType = { type: EditorOpenType.code };
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
      const diffChanges = (diffEditor as BrowserDiffEditor).monacoDiffEditor.getLineChanges();
      if (!diffChanges) {
        return Promise.resolve([]);
      }
      return Promise.resolve(
        diffChanges.map((change) => [
          change.originalStartLineNumber,
          change.originalEndLineNumber,
          change.modifiedStartLineNumber,
          change.modifiedEndLineNumber,
          change.charChanges?.map((charChange) => [
            charChange.originalStartLineNumber,
            charChange.originalStartColumn,
            charChange.originalEndLineNumber,
            charChange.originalEndColumn,
            charChange.modifiedStartLineNumber,
            charChange.modifiedStartColumn,
            charChange.modifiedEndLineNumber,
            charChange.modifiedEndColumn,
          ]),
        ]),
      );
    }

    const dirtyDiffContribution = codeEditor.getContribution('editor.contrib.dirtydiff');

    if (dirtyDiffContribution) {
      return Promise.resolve((dirtyDiffContribution as any).getChanges());
    }

    return Promise.resolve([]);
  }

  private _setIndentConfiguration(model: ITextModel, newConfiguration: ITextEditorUpdateConfiguration): void {
    const creationOpts = StandaloneServices.get(IModelService).getCreationOptions(
      model.getLanguageId(),
      model.uri,
      (model as any).isForSimpleWidget,
    );

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

function getTextEditorId(group: IEditorGroup, uri: URI, side?: string): string {
  return group.name + '.' + (side ? `${side}.` : '') + uri.toString();
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
  return openType.type === EditorOpenType.code || openType.type === EditorOpenType.diff;
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
