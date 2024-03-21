import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { IRange, URI } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { isEqual } from '@opensumi/monaco-editor-core/esm/vs/base/common/resources';
import { AbstractCodeEditorService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/abstractCodeEditorService';
import { ICodeEditorService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/codeEditorService';
import { EditorScopedLayoutService } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneLayoutService';
import { StandaloneServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import { IStandaloneThemeService } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/common/standaloneTheme';
import { ContextViewService } from '@opensumi/monaco-editor-core/esm/vs/platform/contextview/browser/contextViewService';
import { IResourceEditorInput } from '@opensumi/monaco-editor-core/esm/vs/platform/editor/common/editor';

/* istanbul ignore file */
import { EditorOpenType, WorkbenchEditorService } from '../common';

import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';

import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';

@Injectable()
export class MonacoCodeService extends AbstractCodeEditorService {
  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  constructor() {
    super(StandaloneServices.get(IStandaloneThemeService));
  }

  getActiveCodeEditor(): IMonacoCodeEditor | null {
    if (this.workbenchEditorService.currentEditor) {
      return this.workbenchEditorService.currentEditor.monacoEditor;
    }
    return null;
  }

  /**
   * TODO 拆分状态的兼容
   * 判断model是否已存在，在当前editor打开该model
   * @param input 输入的目标文件信息
   * @param source 触发的来源Editor，与grid关联使用
   * @param sideBySide ？
   */
  async openCodeEditor(
    input: IResourceEditorInput,
    source: IMonacoCodeEditor | null,
    sideBySide?: boolean,
  ): Promise<IMonacoCodeEditor | null> {
    const resourceUri = input.resource;
    // 判断打开下一个不同于当前编辑器的文件时，是否需要先固定当前编辑器Tab，从而避免被替换，例如：跳转到定义
    const enablePreviewFromCodeNavigation = this.preferenceService.get<boolean>(
      'editor.enablePreviewFromCodeNavigation',
    );

    if (!enablePreviewFromCodeNavigation && source && !sideBySide && isEqual(source.getModel()?.uri, input.resource)) {
      for (const visibleGroup of this.workbenchEditorService.editorGroups) {
        if (visibleGroup.currentOpenType?.type === EditorOpenType.code) {
          if (visibleGroup.currentEditor?.monacoEditor === source) {
            visibleGroup.pinPreviewed(visibleGroup.currentResource?.uri);
            break;
          }
        } else if (visibleGroup.currentOpenType?.type === EditorOpenType.diff) {
          if (
            visibleGroup.diffEditor!.modifiedEditor.monacoEditor === source ||
            visibleGroup.diffEditor!.originalEditor.monacoEditor === source
          ) {
            visibleGroup.pinPreviewed(visibleGroup.currentResource?.uri);
            break;
          }
        }
      }
    }
    let editorGroup = this.workbenchEditorService.currentEditorGroup;
    let index: number | undefined;
    if (source) {
      editorGroup =
        this.workbenchEditorService.editorGroups.find(
          (g) => g.currentEditor && g.currentEditor.monacoEditor === source,
        ) || editorGroup;
      index = editorGroup.resources.findIndex(
        (r) => editorGroup.currentResource && r.uri === editorGroup.currentResource.uri,
      );
      if (index >= 0) {
        index++;
      }
    }
    // @ts-ignore
    const selection = input.options ? input.options.selection : null;
    let range;
    if (selection) {
      if (typeof selection.endLineNumber === 'number' && typeof selection.endColumn === 'number') {
        range = selection;
      } else {
        range = new monaco.Range(
          selection.startLineNumber!,
          selection.startColumn!,
          selection.startLineNumber!,
          selection.startColumn!,
        );
      }
    }
    const openUri = URI.parse(resourceUri.toString());
    await editorGroup.open(openUri, { index, range: range as IRange, focus: true });
    return (editorGroup.codeEditor as BrowserCodeEditor).monacoEditor;
  }
}

export class MonacoContextViewService extends ContextViewService {
  private menuContainer: HTMLDivElement;

  constructor(codeEditorService: ICodeEditorService) {
    super(new EditorScopedLayoutService(document.body, codeEditorService));
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
    super['setContainer'](this.menuContainer);
  }
}
