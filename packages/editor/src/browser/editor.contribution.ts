import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WorkbenchEditorService, IResourceOpenOptions } from '../common';
import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl, EditorGroupSplitAction, EditorGroup } from './workbench-editor.service';
import { ClientAppContribution, KeybindingContribution, KeybindingRegistry, EDITOR_COMMANDS, CommandContribution, CommandRegistry, URI, Domain, MenuContribution, MenuModelRegistry, localize, MonacoService, ServiceNames, MonacoContribution, CommandService } from '@ali/ide-core-browser';
import { EditorStatusBarService } from './editor.status-bar.service';
import { QuickPickService } from '@ali/ide-quick-open/lib/browser/quick-open.model';
import { MonacoLanguages } from '@ali/ide-language/lib/browser/services/monaco-languages';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { EditorView } from './editor.view';
import { ToolBarContribution, IToolBarViewService, ToolBarPosition } from '@ali/ide-toolbar';

interface Resource  {
  group: EditorGroup;
  uri: URI;
}

@Domain(CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution, MonacoContribution, LayoutContribution, ToolBarContribution)
export class EditorContribution implements CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution, MonacoContribution, LayoutContribution, ToolBarContribution {

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

  @Autowired(CommandService)
  private commandService: CommandService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-editor', {
      component: EditorView,
    }, 'main');
  }

  onMonacoLoaded(monacoService: MonacoService) {
    const { MonacoCodeService, MonacoContextViewService } = require('./editor.override');
    const codeEditorService = this.injector.get(MonacoCodeService);
    monacoService.registerOverride(ServiceNames.CODE_EDITOR_SERVICE, codeEditorService);
    // FIXME 修复右键菜单
    // monacoService.registerOverride(ServiceNames.CONTEXT_VIEW_SERVICE, this.injector.get(MonacoContextViewService));
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.SAVE_CURRENT.id,
      keybinding: 'ctrlcmd+s',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.CLOSE.id,
      keybinding: 'ctrlcmd+w',
    });
  }

  initialize() {
    this.editorStatusBarService.setListener();
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(EDITOR_COMMANDS.OPEN_RESOURCE, {
        execute: (uri: URI, options?: IResourceOpenOptions) => {
          this.workbenchEditorService.open(uri, options);
        },
      });

    commands.registerCommand(EDITOR_COMMANDS.OPEN_RESOURCES, {
        execute: ({uris}: {uris: URI[]}) => {
          this.workbenchEditorService.openUris(uris);
        },
      });

    commands.registerCommand(EDITOR_COMMANDS.COMPARE, {
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

    commands.registerCommand(EDITOR_COMMANDS.SAVE_CURRENT, {
        execute: async () => {
          const editor = this.workbenchEditorService.currentEditor as BrowserCodeEditor;
          if (editor) {
            await editor.save(editor.currentDocumentModel.uri);
          }
        },
      });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_ALL_IN_GROUP, {
        execute: async () => {
          const group = this.workbenchEditorService.currentEditorGroup;
          if (group) {
            await group.closeAll();
          }
        },
      });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE, {
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

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_TO_RIGHT, {
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

    commands.registerCommand(EDITOR_COMMANDS.GET_CURRENT, {
        execute: () => this.workbenchEditorService.currentEditorGroup,
      });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_TO_RIGHT, {
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

    commands.registerCommand(EDITOR_COMMANDS.SPLIT_TO_LEFT, {
        execute: async (resource: Resource) => {
          resource = resource || {};
          const {
            group = this.workbenchEditorService.currentEditorGroup,
            uri = group && group.currentResource && group.currentResource.uri,
          } = resource;
          if (group && uri) {
            await group.split(EditorGroupSplitAction.Left, uri);
          }
        },
      });

    commands.registerCommand(EDITOR_COMMANDS.SPLIT_TO_RIGHT, {
        execute: async (resource: Resource) => {
          resource = resource || {};
          const {
            group = this.workbenchEditorService.currentEditorGroup,
            uri = group && group.currentResource && group.currentResource.uri,
          } = resource;
          if (group && uri) {
            await group.split(EditorGroupSplitAction.Right, uri);
          }
        },
      });

    commands.registerCommand(EDITOR_COMMANDS.SPLIT_TO_TOP, {
        execute: async (resource: Resource) => {
          resource = resource || {};
          const {
            group = this.workbenchEditorService.currentEditorGroup,
            uri = group && group.currentResource && group.currentResource.uri,
          } = resource;
          if (group && uri) {
            await group.split(EditorGroupSplitAction.Top, uri);
          }
        },
      });

    commands.registerCommand(EDITOR_COMMANDS.SPLIT_TO_BOTTOM, {
        execute: async (resource: Resource) => {
          resource = resource || {};
          const {
            group = this.workbenchEditorService.currentEditorGroup,
            uri = group && group.currentResource && group.currentResource.uri,
          } = resource;
          if (group && uri) {
            await group.split(EditorGroupSplitAction.Bottom, uri);
          }
        },
      });

    commands.registerCommand(EDITOR_COMMANDS.CHANGE_LANGUAGE, {
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
    menus.registerMenuAction(['editor', 'split'], {
      commandId: EDITOR_COMMANDS.SPLIT_TO_LEFT.id,
      label: localize('editor.splitToLeft'),
    });
    menus.registerMenuAction(['editor', 'split'], {
      commandId: EDITOR_COMMANDS.SPLIT_TO_RIGHT.id,
      label: localize('editor.splitToRight'),
    });
    menus.registerMenuAction(['editor', 'split'], {
      commandId: EDITOR_COMMANDS.SPLIT_TO_TOP.id,
      label: localize('editor.splitToTop'),
    });
    menus.registerMenuAction(['editor', 'split'], {
      commandId: EDITOR_COMMANDS.SPLIT_TO_BOTTOM.id,
      label: localize('editor.splitToBottom'),
    });
    menus.registerMenuAction(['editor', '0tab'], {
      commandId: EDITOR_COMMANDS.CLOSE.id,
      label: localize('editor.close', '关闭'),
    });
    menus.registerMenuAction(['editor', '0tab'], {
      commandId: EDITOR_COMMANDS.CLOSE_ALL_IN_GROUP.id,
      label: localize('editor.closeAllInGroup'),
    });
    menus.registerMenuAction(['editor', '0tab'], {
      commandId: EDITOR_COMMANDS.CLOSE_TO_RIGHT.id,
      label: localize('editor.closeToRight', '关闭到右侧'),
    });
  }

  registerToolBarElement(registry: IToolBarViewService): void {
    registry.registerToolBarElement({
      type: 'action',
      position: ToolBarPosition.RIGHT,
      iconClass: 'volans_icon embed',
      title: localize('editor.splitToRight'),
      click: () => {
        this.commandService.executeCommand(EDITOR_COMMANDS.SPLIT_TO_RIGHT.id);
      },
    });
  }

}
