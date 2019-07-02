import { CommandContribution, CommandRegistry, URI, Domain, MenuContribution, MenuModelRegistry, localize } from '@ali/ide-core-common';
import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WorkbenchEditorService, IResourceOpenOptions } from '../common';
import { EDITOR_BROWSER_COMMANDS } from '../common/commands';
import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl, EditorGroupSplitAction, EditorGroup } from './workbench-editor.service';
import { ClientAppContribution, KeybindingContribution, KeybindingRegistry, FILE_COMMANDS } from '@ali/ide-core-browser';
import { MonacoService, ServiceNames, MonacoContribution } from '@ali/ide-monaco';
import { EditorStatusBarService } from './editor.status-bar.service';
import { QuickPickService } from '@ali/ide-quick-open/lib/browser/quick-open.model';
import { MonacoLanguages } from '@ali/ide-language/lib/browser/services/monaco-languages';

interface Resource  {
  group: EditorGroup;
  uri: URI;
}

@Domain(CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution, MonacoContribution)
export class EditorContribution implements CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution, MonacoContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired()
  private editorStatusBarService: EditorStatusBarService;

  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

  @Autowired()
  private languagesService: MonacoLanguages;

  onMonacoLoaded(monacoService: MonacoService) {
    const { MonacoCodeService, MonacoContextViewService } = require('./editor.override');
    const codeEditorService = this.injector.get(MonacoCodeService);
    monacoService.registerOverride(ServiceNames.CODE_EDITOR_SERVICE, codeEditorService);
    monacoService.registerOverride(ServiceNames.CONTEXT_VIEW_SERVICE, this.injector.get(MonacoContextViewService));
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: EDITOR_BROWSER_COMMANDS.saveCurrent,
      keybinding: 'ctrlcmd+s',
    });
    keybindings.registerKeybinding({
      command: EDITOR_BROWSER_COMMANDS.close,
      keybinding: 'ctrlcmd+w',
    });
  }

  initialize() {
    this.editorStatusBarService.setListener();
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.openResource,
    }, {
        execute: (uri: URI, options?: IResourceOpenOptions) => {
          this.workbenchEditorService.open(uri, options);
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.openResources,
    }, {
        execute: ({uris}: {uris: URI[]}) => {
          this.workbenchEditorService.openUris(uris);
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.compare,
    }, {
        execute: ({ original, modified, name }: { original: URI, modified: URI, name?: string }) => {
          name = name || `${original.displayName} <=> ${modified.displayName}`;
          this.workbenchEditorService.open(
            URI.from({
              scheme: 'diff',
              query: URI.stringifyQuery({
                name,
                original,
                modified,
              }),
            }),
          );
        },
      });

    commands.registerCommand({
        id: EDITOR_BROWSER_COMMANDS.saveCurrent,
        label: localize('editor.saveCurrent', '保存当前文件'),
      }, {
        execute: async () => {
          const editor = this.workbenchEditorService.currentEditor as BrowserCodeEditor;
          if (editor) {
            await editor.save(editor.currentDocumentModel.uri);
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.closeAllInGroup,
      label: localize('editor.closeAllInGroup'),
    }, {
        execute: async () => {
          const group = this.workbenchEditorService.currentEditorGroup;
          if (group) {
            await group.closeAll();
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.close,
    }, {
        execute: async (resource: Resource) => {
          if (resource) {
            const {
              group = this.workbenchEditorService.currentEditorGroup,
              uri = group && group.currentResource && group.currentResource.uri,
            } = resource;
            if (group && uri) {
              await group.close(uri);
            }
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.closeToRight,
    }, {
        execute: async (resource: Resource) => {
          if (resource) {
            const {
              group = this.workbenchEditorService.currentEditorGroup,
              uri = group && group.currentResource && group.currentResource.uri,
            } = resource;
            if (group && uri) {
              await group.closeToRight(uri);
            }
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.getCurrent,
    }, {
        execute: () => this.workbenchEditorService.currentEditorGroup,
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToRight,
    }, {
        execute: async (resource: Resource) => {
          if (resource) {
            const {
              group = this.workbenchEditorService.currentEditorGroup,
              uri = group && group.currentResource && group.currentResource.uri,
            } = resource;
            if (group && uri) {
              await group.split(EditorGroupSplitAction.Right, uri);
            }
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToLeft,
    }, {
        execute: async (resource: Resource) => {
          if (resource) {
            const {
              group = this.workbenchEditorService.currentEditorGroup,
              uri = group && group.currentResource && group.currentResource.uri,
            } = resource;
            if (group && uri) {
              await group.split(EditorGroupSplitAction.Left, uri);
            }
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToTop,
    }, {
        execute: async (resource: Resource) => {
          if (resource) {
            const {
              group = this.workbenchEditorService.currentEditorGroup,
              uri = group && group.currentResource && group.currentResource.uri,
            } = resource;
            if (group && uri) {
              await group.split(EditorGroupSplitAction.Top, uri);
            }
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.splitToBottom,
    }, {
        execute: async (resource: Resource) => {
          if (resource) {
            const {
              group = this.workbenchEditorService.currentEditorGroup,
              uri = group && group.currentResource && group.currentResource.uri,
            } = resource;
            if (group && uri) {
              await group.split(EditorGroupSplitAction.Bottom, uri);
            }
          }
        },
      });

    commands.registerCommand({
      id: EDITOR_BROWSER_COMMANDS.changeLanguage,
    }, {
      execute: async (currentLanguageId) => {
        const allLanguages = this.languagesService.languages;
        const allLanguageItems = allLanguages.map((language) => ({
          label: language.name,
          value: language.id,
          description: `(${language.id})`,
        }));
        const targetLanguageId = await this.quickPickService.show(allLanguageItems);
        if (targetLanguageId && currentLanguageId !== targetLanguageId) {
          if (this.workbenchEditorService.currentCodeEditor) {
            const currentDocModel = this.workbenchEditorService.currentCodeEditor.currentDocumentModel;
            if (currentDocModel) {
              monaco.editor.setModelLanguage(currentDocModel.toEditor(), targetLanguageId);
              currentDocModel.language = targetLanguageId;
            }
          }
        }
      },
    });

  }

  registerMenus(menus: MenuModelRegistry) {
    menus.registerMenuAction(['editor', 'split', 'split-to-left'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToLeft,
      label: localize('editor.splitToLeft'),
    });
    menus.registerMenuAction(['editor', 'split', 'split-to-right'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToRight,
      label: localize('editor.splitToRight'),
    });
    menus.registerMenuAction(['editor', 'split', 'split-to-top'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToTop,
      label: localize('editor.splitToTop'),
    });
    menus.registerMenuAction(['editor', 'split', 'split-to-bottom'], {
      commandId: EDITOR_BROWSER_COMMANDS.splitToBottom,
      label: localize('editor.splitToBottom'),
    });
    menus.registerMenuAction(['editor', '0tab', 'close'], {
      commandId: EDITOR_BROWSER_COMMANDS.close,
      label: localize('editor.close', '关闭'),
    });
    menus.registerMenuAction(['editor', '0tab', 'closeAllInGroup'], {
      commandId: EDITOR_BROWSER_COMMANDS.closeAllInGroup,
      label: localize('editor.closeAllInGroup'),
    });
    menus.registerMenuAction(['editor', '0tab', 'closeToRight'], {
      commandId: EDITOR_BROWSER_COMMANDS.closeToRight,
      label: localize('editor.closeToRight', '关闭到右侧'),
    });
  }
}
