import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { WorkbenchEditorService, EditorCollectionService } from '../common';
import { URI, IRange } from '@ali/ide-core-common';
import { Autowired, Injectable } from '@ali/common-di';
import { IMonacoImplEditor, BrowserCodeEditor } from './editor-collection.service';

@Injectable()
export class MonacoCodeService extends monaco.services.CodeEditorServiceImpl {

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  constructor() {
    super(monaco.services.StaticServices.standaloneThemeService.get());
  }

  getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined {
    if (this.workbenchEditorService.currentEditor) {
      return (this.workbenchEditorService.currentEditor as IMonacoImplEditor).monacoEditor;
    }
  }

  /**
   * TODO 拆分状态的兼容
   * 判断model是否已存在，在当前editor打开该model
   * @param input 输入的目标文件信息
   * @param source 触发的来源Editor，与grid关联使用
   * @param sideBySide ？
   */
  // @ts-ignore
  async openCodeEditor(input: monaco.editor.IResourceInput, source?: monaco.editor.ICodeEditor,
                       sideBySide?: boolean): Promise<monaco.editor.CommonCodeEditor | undefined> {
    const resourceUri = new URI(input.resource.toString());
    let editorGroup = this.workbenchEditorService.currentEditorGroup;
    let index: number | undefined;
    if (source) {
      editorGroup = this.workbenchEditorService.editorGroups.find((g) => g.currentEditor && (g.currentEditor as IMonacoImplEditor).monacoEditor === source) || editorGroup;
      index = editorGroup.resources.findIndex((r) => editorGroup.currentResource && r.uri === editorGroup.currentResource.uri);
      if (index >= 0) {
        index ++;
      }
    }
    await editorGroup.open(resourceUri, {index, range: input.options && input.options.selection as IRange, preserveFocus: true});
    return (editorGroup.codeEditor as BrowserCodeEditor).monacoEditor;
  }

}

@Injectable()
export class MonacoContextViewService extends monaco.services.ContextViewService {

  @Autowired(EditorCollectionService)
  private editorCollectionService: EditorCollectionService;

  private menuContainer: HTMLDivElement;

  private contextView: any;

  constructor() {
    super(new monaco.services.SimpleLayoutService(document.body));
  }

  setContainer(container) {
    if (!this.menuContainer) {
      this.menuContainer = document.createElement('div');
      this.menuContainer.className = container.className;
      this.menuContainer.style.left = '0';
      this.menuContainer.style.top = '0';
      this.menuContainer.style.position = 'fixed';
      this.menuContainer.style.zIndex = '10';
      document.body.append(this.menuContainer);
    }
    this.contextView.setContainer(this.menuContainer);
  }
}
