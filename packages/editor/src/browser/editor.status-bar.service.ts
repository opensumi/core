import { Injectable, Autowired } from '@ali/common-di';
import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { WorkbenchEditorService, IEditor, CursorStatus, ILanguageService } from '../common';
import { localize, WithEventBus, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { DocModelLanguageChangeEvent } from '@ali/ide-doc-model/lib/browser/event';

@Injectable()
export class EditorStatusBarService extends WithEventBus {

  @Autowired(StatusBar)
  statusBar: StatusBar;

  @Autowired()
  workbenchEditorService: WorkbenchEditorService;

  @Autowired(ILanguageService)
  languageService: ILanguageService;

  setListener() {
    this.workbenchEditorService.onActiveResourceChange(() => {
      this.updateLanguageStatus(this.workbenchEditorService.currentEditor);
    });
    this.workbenchEditorService.onCursorChange((cursorStatus) => {
      this.updateCursorStatus(cursorStatus);
    });
    this.eventBus.on(DocModelLanguageChangeEvent, (e) => {
      const currentEditor = this.workbenchEditorService.currentEditor;
      if (currentEditor && currentEditor.currentUri && currentEditor.currentUri.isEqual(e.payload.uri)) {
        this.updateLanguageStatus(this.workbenchEditorService.currentEditor);
      }
    });
  }

  protected updateCursorStatus(cursorStatus: CursorStatus) {
    const {position, selectionLength} = cursorStatus;
    if (!position) {
      this.statusBar.removeElement('editor-status-cursor');
      return;
    }
    const lineLabel = localize('status-bar.label.line', '行');
    const colLabel = localize('status-bar.label.column', '列');
    const selectedLabel = localize('status-bar.label.selected', '已选择');
    this.statusBar.addElement('editor-status-cursor', {
      text: `${lineLabel}${position.lineNumber}，${colLabel}${position.column}${selectionLength ? `（${selectedLabel}${selectionLength}）` : ''}`,
      priority: 4,
      alignment: StatusBarAlignment.RIGHT,
    });
  }

  // TODO 更新 Language 状态
  protected updateLanguageStatus(editor: IEditor | null): void {
    if (!editor) {
      this.statusBar.removeElement('editor-status-language');
      this.statusBar.removeElement('editor-status-encoding');
      this.statusBar.removeElement('editor-status-eol');
      return;
    }
    let languageId = '';
    let encoding = '';
    let eol = '';
    const documentModel = editor.currentDocumentModel;
    if (documentModel) {
      languageId = documentModel.language!;
      encoding = documentModel.encoding;
      eol = documentModel.eol;
    }
    const eolText = eol === '\n' ? 'LF' : 'CRLF';
    const language = this.languageService.getLanguage(languageId);
    const languageName = language ? language.name : '';
    this.statusBar.addElement('editor-status-language', {
      text: languageName,
      alignment: StatusBarAlignment.RIGHT,
      priority: 1,
      command: EDITOR_COMMANDS.CHANGE_LANGUAGE.id,
    });
    // TODO 语言的配置能力
    this.statusBar.addElement('editor-status-encoding', {
      text: encoding,
      alignment: StatusBarAlignment.RIGHT,
      priority: 2,
      command: EDITOR_COMMANDS.CHANGE_ENCODING.id,
    });
    this.statusBar.addElement('editor-status-eol', {
      text: eolText,
      alignment: StatusBarAlignment.RIGHT,
      priority: 3,
      command: EDITOR_COMMANDS.CHANGE_EOL.id,
    });
  }

}
