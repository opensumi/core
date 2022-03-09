import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { URI, IRange } from '@opensumi/ide-core-common';
import type { ICodeEditor as IMonacoCodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { ICodeEditorService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/codeEditorService';
import { CodeEditorServiceImpl } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/codeEditorServiceImpl';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { SimpleLayoutService } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/simpleServices';
import { StaticServices } from '@opensumi/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices';
import { ContextViewService } from '@opensumi/monaco-editor-core/esm/vs/platform/contextview/browser/contextViewService';

/* istanbul ignore file */
import { WorkbenchEditorService } from '../common';

import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl } from './workbench-editor.service';


@Injectable()
export class MonacoCodeService extends CodeEditorServiceImpl {
  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  constructor() {
    super(null, StaticServices.standaloneThemeService.get());
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
    // @ts-ignore
    input: monaco.editor.IResourceInput,
    source: IMonacoCodeEditor | null,
    sideBySide?: boolean,
  ): Promise<IMonacoCodeEditor | null> {
    const resourceUri = new URI(input.resource.toString());
    // 判断打开下一个不同于当前编辑器的文件时，是否需要先固定当前编辑器Tab，从而避免被替换，例如：跳转到定义
    const enablePreviewFromCodeNavigation = this.preferenceService.get<boolean>(
      'editor.enablePreviewFromCodeNavigation',
    );
    if (
      !enablePreviewFromCodeNavigation &&
      source &&
      !sideBySide &&
      !new URI(source.getModel()?.uri).isEqual(input.resource)
    ) {
      for (const visibleGroup of this.workbenchEditorService.editorGroups) {
        if (visibleGroup.currentOpenType?.type === 'code') {
          if (visibleGroup.currentEditor?.monacoEditor === source) {
            visibleGroup.pinPreviewed(visibleGroup.currentResource?.uri);
            break;
          }
        } else if (visibleGroup.currentOpenType?.type === 'diff') {
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
    await editorGroup.open(resourceUri, { index, range: range as IRange, focus: true });
    return (editorGroup.codeEditor as BrowserCodeEditor).monacoEditor;
  }
}

export class MonacoContextViewService extends ContextViewService {
  private menuContainer: HTMLDivElement;

  constructor(codeEditorService: ICodeEditorService) {
    super(new SimpleLayoutService(codeEditorService, document.body));
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
    super.setContainer(this.menuContainer);
  }
}
