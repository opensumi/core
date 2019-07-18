import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { IMainThreadEditorsService, IExtensionHostEditorService, ExtHostAPIIdentifier, IEditorChangeDTO, IResolvedTextEditorConfiguration } from '../../common';
import { WorkbenchEditorService, IEditorGroup, IResource, IEditor } from '@ali/ide-editor';
import { WorkbenchEditorServiceImpl } from '@ali/ide-editor/lib/browser/workbench-editor.service';
import { WithEventBus, MaybeNull } from '@ali/ide-core-common';
import { EditorGroupOpenEvent, EditorGroupChangeEvent, IEditorOpenType } from '@ali/ide-editor/lib/browser';
import { IRPCProtocol } from '@ali/ide-connection';
import { IMonacoImplEditor } from '@ali/ide-editor/lib/browser/editor-collection.service';

@Injectable()
export class MainThreadEditorService extends WithEventBus implements IMainThreadEditorsService {

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorServiceImpl;

  private readonly proxy: IExtensionHostEditorService;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEditors);
    this.startEvents();
  }

  $getInitialState() {
    this.startEvents();
    return {

    };

  }

  startEvents() {
    this.eventBus.on(EditorGroupChangeEvent, (event) => {
      const payload = event.payload;
      if (payload.newResource !== payload.oldResource) {
        const change: IEditorChangeDTO = {};
        if (payload.newOpenType && (payload.newOpenType.type === 'code' || payload.newOpenType.type === 'diff')) {
          const editor = payload.group.currentEditor as IMonacoImplEditor;
          change.created = [
            {
              id: getTextEditorId(payload.group, payload.newResource!),
              uri: payload.newResource!.uri.toString(),
              selections: editor!.getSelections() || [],
              options: getEditorOption(editor.monacoEditor),
              viewColumn: 0, // TODO
              visibleRanges: editor.monacoEditor.getVisibleRanges(),
            },
          ];
        }
        if (payload.oldOpenType && (payload.oldOpenType.type === 'code' || payload.oldOpenType.type === 'diff')) {
          change.removed = [getTextEditorId(payload.group, payload.oldResource!)];
        }
        this.proxy.$acceptChange(change);
      }
    });
    this.editorService.onActiveResourceChange((resource) => {
      if (resource && this.editorService.currentEditorGroup && isEditor(this.editorService.currentEditorGroup.currentOpenType)) {
        this.proxy.$acceptChange({
          actived: getTextEditorId(this.editorService.currentEditorGroup, this.editorService.currentResource!),
        });
      } else {
        this.proxy.$acceptChange({
          actived: undefined,
        });
      }
    });
  }

}

function getTextEditorId(group: IEditorGroup, resource: IResource): string {
  return group.name + '.' + resource.uri;
}

function getEditorOption(editor: monaco.editor.ICodeEditor): IResolvedTextEditorConfiguration {
  const modelOptions = editor.getModel()!.getOptions();
  return {
    tabSize: modelOptions.tabSize,
    indentSize: modelOptions.indentSize,
    insertSpaces: modelOptions.insertSpaces,
    cursorStyle: editor.getConfiguration().viewInfo.cursorStyle,
    lineNumbers: editor.getConfiguration().viewInfo.renderLineNumbers as any,
  };
}

function isEditor(openType: MaybeNull<IEditorOpenType>): boolean {
  if (!openType) {
    return false;
  }
  return openType.type === 'code' || openType.type === 'diff';
}
