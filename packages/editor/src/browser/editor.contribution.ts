import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WorkbenchEditorService, IResourceOpenOptions, EditorGroupSplitAction, ILanguageService, Direction, ResourceService } from '../common';
import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl, EditorGroup } from './workbench-editor.service';
import { ClientAppContribution, KeybindingContribution, KeybindingRegistry, EDITOR_COMMANDS, CommandContribution, CommandRegistry, URI, Domain, MenuContribution, MenuModelRegistry, localize, MonacoService, ServiceNames, MonacoContribution, CommandService, QuickPickService, IEventBus, isElectronRenderer } from '@ali/ide-core-browser';
import { EditorStatusBarService } from './editor.status-bar.service';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { EditorView } from './editor.view';
import { ToolBarContribution, IToolBarViewService, ToolBarPosition } from '@ali/ide-toolbar';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { EditorGroupsResetSizeEvent } from './types';
import { IClientApp } from '@ali/ide-core-browser';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

interface Resource {
  group: EditorGroup;
  uri: URI;
}

@Domain(CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution, MonacoContribution, ComponentContribution, ToolBarContribution)
export class EditorContribution implements CommandContribution, MenuContribution, ClientAppContribution, KeybindingContribution, MonacoContribution, ComponentContribution, ToolBarContribution {

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(ResourceService)
  private resourceService: ResourceService;

  @Autowired()
  private editorStatusBarService: EditorStatusBarService;

  @Autowired(QuickPickService)
  private quickPickService: QuickPickService;

  @Autowired(ILanguageService)
  private languagesService: ILanguageService;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(ContextMenuRenderer)
  private contextMenuRenderer: ContextMenuRenderer;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-editor', {
      id: 'ide-editor',
      component: EditorView,
    });
  }

  onMonacoLoaded(monacoService: MonacoService) {
    const { MonacoCodeService, MonacoContextViewService } = require('./editor.override');
    const codeEditorService = this.injector.get(MonacoCodeService);
    monacoService.registerOverride(ServiceNames.CODE_EDITOR_SERVICE, codeEditorService);
    monacoService.registerOverride(ServiceNames.CONTEXT_VIEW_SERVICE, this.injector.get(MonacoContextViewService));
    const { MonacoTextModelService } = require('./doc-model/override');
    const textModelService = this.injector.get(MonacoTextModelService);
    monacoService.registerOverride(ServiceNames.TEXT_MODEL_SERVICE, textModelService);
  }

  onWillStop(app: IClientApp) {
    if (isElectronRenderer()) {
      return this.onWillStopElectron();
    } else {
      return this.workbenchEditorService.hasDirty();
    }
  }

  async onWillStopElectron() {
    for (const group of this.workbenchEditorService.editorGroups) {
      for ( const resource of group.resources) {
        if (!await this.resourceService.shouldCloseResource(resource, [])) {
          return true;
        }
      }
    }
    return false;
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.SAVE_CURRENT.id,
      keybinding: 'ctrlcmd+s',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.CLOSE.id,
      keybinding: 'ctrlcmd+w', // FIXME web上会被chrome拦截
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.PREVIOUS.id,
      keybinding: 'alt+cmd+left', // FIXME web上会被chrome拦截
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.NEXT.id,
      keybinding: 'alt+cmd+right', // FIXME web上会被chrome拦截
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
      execute: ({ uris }: { uris: URI[] }) => {
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
          await editor.save();
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

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_OTHER_IN_GROUP, {
      execute: async (resource: Resource) => {
        resource = resource || {};
        const {
          group = this.workbenchEditorService.currentEditorGroup,
          uri = group && group.currentResource && group.currentResource.uri,
        } = resource;
        if (group && uri) {
          await group.closeOthers(uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE, {
      execute: async (resource: Resource) => {
        resource = resource || {};
        const {
          group = this.workbenchEditorService.currentEditorGroup,
          uri = group && group.currentResource && group.currentResource.uri,
        } = resource;
        if (group && uri) {
          await group.close(uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_TO_RIGHT, {
      execute: async (resource: Resource) => {
        resource = resource || {};
        const {
          group = this.workbenchEditorService.currentEditorGroup,
          uri = group && group.currentResource && group.currentResource.uri,
        } = resource;
        if (group && uri) {
          await group.closeToRight(uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.GET_CURRENT, {
      execute: () => this.workbenchEditorService.currentEditorGroup,
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
              monaco.editor.setModelLanguage(currentDocModel.getMonacoModel(), targetLanguageId);
              currentDocModel.languageId = targetLanguageId;
            }
          }
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.NAVIGATE_NEXT, {
      execute: async () => {
        let i = this.workbenchEditorService.currentEditorGroup.index + 1;
        if (this.workbenchEditorService.editorGroups.length <= i) {
          i = 0;
        }
        return this.workbenchEditorService.editorGroups[i].focus();
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.NAVIGATE_UP, {
      execute: async () => {
        const currentGrid = this.workbenchEditorService.currentEditorGroup.grid;
        const targetGrid = currentGrid.findGird(Direction.UP);
        if (targetGrid) {
          return (targetGrid.editorGroup! as EditorGroup).focus();
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.NAVIGATE_DOWN, {
      execute: async () => {
        const currentGrid = this.workbenchEditorService.currentEditorGroup.grid;
        const targetGrid = currentGrid.findGird(Direction.DOWN);
        if (targetGrid) {
          return (targetGrid.editorGroup! as EditorGroup).focus();
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.NAVIGATE_LEFT, {
      execute: async () => {
        const currentGrid = this.workbenchEditorService.currentEditorGroup.grid;
        const targetGrid = currentGrid.findGird(Direction.LEFT);
        if (targetGrid) {
          return (targetGrid.editorGroup! as EditorGroup).focus();
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.NAVIGATE_RIGHT, {
      execute: async () => {
        const currentGrid = this.workbenchEditorService.currentEditorGroup.grid;
        const targetGrid = currentGrid.findGird(Direction.RIGHT);
        if (targetGrid) {
          return (targetGrid.editorGroup! as EditorGroup).focus();
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.PREVIOUS_IN_GROUP, {
      execute: async () => {
        const editorGroup = this.workbenchEditorService.currentEditorGroup;
        if (!editorGroup.currentResource) {
          return;
        }
        const index = editorGroup.resources.findIndex((r) => r.uri.isEqual(editorGroup.currentResource!.uri)) - 1;
        if (editorGroup.resources[index]) {
          return editorGroup.open(editorGroup.resources[index].uri);
        } else {
          return editorGroup.open(editorGroup.resources[0].uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.PREVIOUS_IN_GROUP, {
      execute: async () => {
        const editorGroup = this.workbenchEditorService.currentEditorGroup;
        if (!editorGroup.currentResource) {
          return;
        }
        const index = editorGroup.resources.findIndex((r) => r.uri.isEqual(editorGroup.currentResource!.uri)) + 1;
        if (editorGroup.resources[index]) {
          return editorGroup.open(editorGroup.resources[index].uri);
        } else {
          return editorGroup.open(editorGroup.resources[editorGroup.resources.length - 1].uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.NEXT, {
      execute: async () => {
        const editorGroup = this.workbenchEditorService.currentEditorGroup;
        if (!editorGroup.currentResource) {
          return;
        }
        const index = editorGroup.resources.findIndex((r) => r.uri.isEqual(editorGroup.currentResource!.uri)) + 1;
        if (editorGroup.resources[index]) {
          return editorGroup.open(editorGroup.resources[index].uri);
        } else {
          const nextEditorGroupIndex = editorGroup.index === this.workbenchEditorService.editorGroups.length - 1 ? 0 : editorGroup.index + 1;
          const nextEditorGroup = this.workbenchEditorService.editorGroups[nextEditorGroupIndex];
          nextEditorGroup.focus();
          return nextEditorGroup.open(nextEditorGroup.resources[0].uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.PREVIOUS, {
      execute: async () => {
        const editorGroup = this.workbenchEditorService.currentEditorGroup;
        if (!editorGroup.currentResource) {
          return;
        }
        const index = editorGroup.resources.findIndex((r) => r.uri.isEqual(editorGroup.currentResource!.uri)) - 1;
        if (editorGroup.resources[index]) {
          return editorGroup.open(editorGroup.resources[index].uri);
        } else {
          const nextEditorGroupIndex = editorGroup.index === 0 ? this.workbenchEditorService.editorGroups.length - 1 : editorGroup.index - 1;
          const nextEditorGroup = this.workbenchEditorService.editorGroups[nextEditorGroupIndex];
          nextEditorGroup.focus();
          return nextEditorGroup.open(nextEditorGroup.resources[nextEditorGroup.resources.length - 1].uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.LAST_IN_GROUP, {
      execute: async () => {
        const editorGroup = this.workbenchEditorService.currentEditorGroup;
        if (editorGroup.resources.length > 0) {
          return editorGroup.open(editorGroup.resources[editorGroup.resources.length - 1].uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.EVEN_EDITOR_GROUPS, {
      execute: async () => {
        const eventBus: IEventBus = this.injector.get(IEventBus);
        eventBus.fire(new EditorGroupsResetSizeEvent());
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_OTHER_GROUPS, {
      execute: async () => {
        const editorGroup = this.workbenchEditorService.currentEditorGroup;
        const groupsToClose = this.workbenchEditorService.editorGroups.filter((e) => e !== editorGroup);
        groupsToClose.forEach((g) => {
          g.dispose();
        });
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.OPEN_EDITOR_AT_INDEX, {
      execute: async (index) => {
        const editorGroup = this.workbenchEditorService.currentEditorGroup;
        const target = editorGroup.resources[index];
        if (target) {
          await editorGroup.open(target.uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.REVERT_DOCUMENT, {
      execute: async () => {
        const group = this.workbenchEditorService.currentEditorGroup;
        if (group.isCodeEditorMode()) {
          const documentModel = group.codeEditor.currentDocumentModel;
          if (documentModel) {
            await documentModel.revert();
          }
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.REVERT_AND_CLOSE, {
      execute: async () => {
        const group = this.workbenchEditorService.currentEditorGroup;
        if (group.isCodeEditorMode()) {
          const documentModel = group.codeEditor.currentDocumentModel;
          if (documentModel) {
            await documentModel.revert();
          }
          group.close(group.currentResource!.uri);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.SAVE_ALL, {
      execute: async () => {
        this.workbenchEditorService.saveAll();
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_ALL, {
      execute: async () => {
        this.workbenchEditorService.closeAll();
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
      commandId: EDITOR_COMMANDS.CLOSE_OTHER_IN_GROUP.id,
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
      iconClass: getIcon('embed'),
      title: localize('editor.splitToRight'),
      click: () => {
        this.commandService.executeCommand(EDITOR_COMMANDS.SPLIT_TO_RIGHT.id);
      },
    });

    registry.registerToolBarElement({
      type: 'action',
      position: ToolBarPosition.RIGHT,
      iconClass: getIcon('arrow-down'),
      title: localize('editor.moreActions'),
      click: (event) => {
        const { x, y } = event.nativeEvent;
        this.contextMenuRenderer.render(['editor', 'title'], { x, y });
        event.stopPropagation();
        event.preventDefault();
      },
    });
  }

}
