import { WorkbenchEditorServiceImpl } from './workbench-editor.service';
import { WorkbenchEditorService } from '../common';
import { URI } from '@ali/ide-core-common';
import { Autowired, Injectable } from '@ali/common-di';

@Injectable()
export class MonacoCodeService extends monaco.services.CodeEditorServiceImpl {

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  constructor() {
    super(monaco.services.StaticServices.standaloneThemeService.get());
  }

  getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined {
    if (this.workbenchEditorService.currentEditor) {
      return this.workbenchEditorService.currentEditor.editor;
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
      return this.workbenchEditorService.currentEditor.editor;
    }
  }

}
