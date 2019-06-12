import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { WorkbenchEditorService, EditorCollectionService } from '../common';
import { URI } from '@ali/ide-core-common';
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
   * 判断model是否已存在，在当前editor打开该model
   * @param input 输入的目标文件信息
   * @param source 触发的来源Editor，与grid关联使用
   * @param sideBySide ？
   */
  async openCodeEditor(input: monaco.editor.IResourceInput, source?: monaco.editor.ICodeEditor,
                       sideBySide?: boolean): Promise<monaco.editor.CommonCodeEditor | undefined> {
    const resourceUri = new URI(input.resource.toString());
    await this.workbenchEditorService.open(resourceUri);
    if (this.workbenchEditorService.currentEditor) {
      return (this.workbenchEditorService.currentCodeEditor as BrowserCodeEditor).monacoEditor;
    }
  }

}

@Injectable()
export class MonacoContextViewService extends monaco.services.ContextViewService {

  @Autowired(EditorCollectionService)
  private editorCollectionService: EditorCollectionService;

  private menuContainer: HTMLDivElement;

  private contextView: any;

  constructor() {
    super(document.body, monaco.services.StaticServices.telemetryService.get(), monaco.services.StaticServices.logService.get());
  }

  setContainer() {
    if (!this.menuContainer) {
      this.menuContainer = document.createElement('div');
      this.menuContainer.className = (this.editorCollectionService.listEditors()[0] as IMonacoImplEditor).monacoEditor.getDomNode()!.className;
      document.body.append(this.menuContainer);
    }
    this.contextView.setContainer(this.menuContainer);
  }
}
