import { Injectable, Autowired, Injector, INJECTOR_TOKEN, Optinal } from '@ali/common-di';
import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { MonacoLanguages } from '@ali/ide-language/lib/browser/services/monaco-languages';
import { Languages } from '@ali/ide-language/lib/browser/language-client-services';
import { WorkbenchEditorService, IEditor, EDITOR_BROWSER_COMMANDS, CursorStatus } from '../common';

@Injectable()
export class EditorStatusBarService {

  @Autowired(StatusBar)
  statusBar: StatusBar;

  @Autowired(MonacoLanguages)
  languages: Languages;

  @Autowired()
  workbenchEditorService: WorkbenchEditorService;

  setListener() {
    this.workbenchEditorService.onActiveResourceChange(() => {
      this.updateLanguageStatus(this.workbenchEditorService.currentEditor);
    });
    this.workbenchEditorService.onCursorChange((cursorStatus) => {
      this.updateCursorStatus(cursorStatus);
    });
  }

  protected updateCursorStatus(cursorStatus: CursorStatus) {
    const {position, selectionLength} = cursorStatus;
    if (!position) {
      this.statusBar.removeElement('editor-status-cursor');
      return;
    }
    this.statusBar.addElement('editor-status-cursor', {
      text: `行${position.lineNumber}，列${position.column}${selectionLength ? '已选择' + selectionLength : ''}`,
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
    const language = this.languages.getLanguage(languageId);
    const languageName = language ? language.name : '';
    // TODO command implement
    this.statusBar.addElement('editor-status-language', {
      text: languageName,
      alignment: StatusBarAlignment.RIGHT,
      priority: 1,
      command: EDITOR_BROWSER_COMMANDS.changeLanguage,
    });
    this.statusBar.addElement('editor-status-encoding', {
      text: encoding,
      alignment: StatusBarAlignment.RIGHT,
      priority: 2,
      command: EDITOR_BROWSER_COMMANDS.changeEncoding,
    });
    this.statusBar.addElement('editor-status-eol', {
      text: eolText,
      alignment: StatusBarAlignment.RIGHT,
      priority: 3,
      command: EDITOR_BROWSER_COMMANDS.changeEol,
    });
  }

}
