import { Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  Domain,
  IStatusBarService,
  localize,
  Severity,
  StatusBarAlignment,
  WithEventBus,
} from '@opensumi/ide-core-browser';

import { WorkbenchEditorService, IEditor, ILanguageStatusService, ILanguageStatus } from '../../common';
import { EditorDocumentModelOptionChangedEvent } from '../doc-model/types';

@Domain(ClientAppContribution)
export class LanguageStatusContribution extends WithEventBus implements ClientAppContribution {
  @Autowired(IStatusBarService)
  private readonly statusBar: IStatusBarService;

  @Autowired()
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(ILanguageStatusService)
  private readonly languageStatusService: ILanguageStatusService;

  initialize() {
    this.workbenchEditorService.onActiveResourceChange(() => {
      this.updateLanguageStatus(this.workbenchEditorService.currentEditor);
    });

    this.eventBus.on(EditorDocumentModelOptionChangedEvent, (e) => {
      const currentEditor = this.workbenchEditorService.currentEditor;
      if (currentEditor && currentEditor.currentUri && currentEditor.currentUri.isEqual(e.payload.uri)) {
        this.updateLanguageStatus(this.workbenchEditorService.currentEditor);
      }
    });
  }

  protected updateLanguageStatus(editor: IEditor | null): void {
    if (!editor) {
      this.statusBar.removeElement('editor-status-language-status');
      return;
    }

    const documentModel = editor.currentDocumentModel;

    if (documentModel) {
      const all = this.languageStatusService.getLanguageStatus(documentModel.getMonacoModel());
      if (all.length) {
        this.statusBar.addElement('editor-status-language-status', {
          name: localize('status-bar.editor-langStatus'),
          alignment: StatusBarAlignment.RIGHT,
          text: this.getLanguageStatusText(all),
          // 默认在选择语言模式左边
          priority: 1.1,
          hoverContents: all.map((status) => ({
            title: status.label,
            name: status.name,
            command: status.command,
          })),
          // 添加个空的执行函数以便点击状态栏有相应态
          onClick: () => {},
        });
      }
    }
  }
  private getLanguageStatusText(status: ILanguageStatus[]) {
    if (status.length === 0) {
      return;
    }
    const [first] = status;
    switch (first.severity) {
      case Severity.Error:
        return '$(bracket-error)';
      case Severity.Warning:
        return '$(bracket-dot)';
      default:
        return '$(bracket)';
    }
  }
}
