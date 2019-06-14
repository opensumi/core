import { CommandContribution, CommandRegistry, URI, Domain, MenuContribution, MenuModelRegistry, localize } from '@ali/ide-core-common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WorkbenchEditorService, IResource, IEditor } from '../common';
import { EDITOR_BROWSER_COMMANDS } from '../common/commands';
import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl, EditorGroupSplitAction } from './workbench-editor.service';
import { ClientAppContribution } from '@ali/ide-core-browser';
import { MonacoService, ServiceNames } from '@ali/ide-monaco';
import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { MonacoLanguages } from '@ali/ide-language/lib/browser/services/monaco-languages';
import { Languages } from '@ali/ide-language/lib/browser/language-client-services';

@Injectable()
@Domain(CommandContribution, MenuContribution, ClientAppContribution)
export class EditorContribution implements CommandContribution, MenuContribution, ClientAppContribution {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired()
  monacoService: MonacoService;

  @Autowired(StatusBar)
  statusBar: StatusBar;

  @Autowired(MonacoLanguages)
  languages: Languages;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  waitUntilMonacoLoaded() {
    return new Promise((resolve, reject) => {
      this.monacoService.onMonacoLoaded((loaded) => {
        if (loaded) {
          resolve();
        } else {
          reject();
        }
      });
    });
  }

  onStart() {
    this.waitUntilMonacoLoaded().then(() => {
      const { MonacoCodeService, MonacoContextViewService } = require('./editor.override');
      const codeEditorService = this.injector.get(MonacoCodeService);
      this.monacoService.registerOverride(ServiceNames.CODE_EDITOR_SERVICE, codeEditorService);
      this.monacoService.registerOverride(ServiceNames.CONTEXT_VIEW_SERVICE, this.injector.get(MonacoContextViewService));
    });
  }

  // TODO 更新 Language 状态
  protected updateLanguageStatus(editor: IEditor | undefined): void {
    if (!editor) {
      this.statusBar.removeElement('editor-status-language');
      return;
    }
    const language = this.languages.getLanguage && this.languages.getLanguage(editor.getId());
    const languageName = language ? language.name : '';
    this.statusBar.setElement('editor-status-language', {
      text: languageName,
      alignment: StatusBarAlignment.RIGHT,
      priority: 1,
      command: 'EditorCommands.CHANGE_LANGUAGE',
    });
  }

  registerCommands(commands: CommandRegistry): void {

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.openResource,
    }, {
        execute: (uri: URI) => {
          this.workbenchEditorService.open(uri);
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.saveCurrent,
    }, {
        execute: async () => {
          const editor = this.workbenchEditorService.currentEditor as BrowserCodeEditor;
          if (editor) {
            await editor.save(editor.currentDocumentModel.uri);
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.getCurrent,
    }, {
        execute: () => this.workbenchEditorService.currentEditorGroup,
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToLeft,
      label: localize('editor.splitToLeft'),
    }, {
        execute: () => {
          if (this.workbenchEditorService.currentEditorGroup.currentResource) {
            this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Left, this.workbenchEditorService.currentEditorGroup.currentResource!);
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToRight,
      label: localize('editor.splitToRight'),
    }, {
        execute: () => {
          if (this.workbenchEditorService.currentEditorGroup.currentResource) {
            this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Right, this.workbenchEditorService.currentEditorGroup.currentResource!);
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToLeft,
      label: localize('editor.splitToLeft'),
    }, {
        execute: () => {
          if (this.workbenchEditorService.currentEditorGroup.currentResource) {
            this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Left, this.workbenchEditorService.currentEditorGroup.currentResource!);
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToRight,
      label: localize('editor.splitToRight'),
    }, {
        execute: () => {
          if (this.workbenchEditorService.currentEditorGroup.currentResource) {
            this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Right, this.workbenchEditorService.currentEditorGroup.currentResource!);
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToTop,
      label: localize('editor.splitToTop'),
    }, {
        execute: () => {
          if (this.workbenchEditorService.currentEditorGroup.currentResource) {
            this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Top, this.workbenchEditorService.currentEditorGroup.currentResource!);
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToBottom,
      label: localize('editor.splitToBottom'),
    }, {
        execute: () => {
          if (this.workbenchEditorService.currentEditorGroup.currentResource) {
            this.workbenchEditorService.currentEditorGroup.split(EditorGroupSplitAction.Bottom, this.workbenchEditorService.currentEditorGroup.currentResource!);
          }
        },
      });

  }

  registerMenus(menus: MenuModelRegistry) {
    menus.registerMenuAction(['editor', 'split-to-left'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToLeft,
    });
    menus.registerMenuAction(['editor', 'split-to-right'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToRight,
    });
    menus.registerMenuAction(['editor', 'split-to-top'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToTop,
    });
    menus.registerMenuAction(['editor', 'split-to-bottom'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToBottom,
    });
  }
}
