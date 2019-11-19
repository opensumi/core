import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { WorkbenchEditorService, IResourceOpenOptions, EditorGroupSplitAction, ILanguageService, Direction, ResourceService, IDocPersistentCacheProvider, IEditor, IEditorGroup } from '../common';
import { BrowserCodeEditor } from './editor-collection.service';
import { WorkbenchEditorServiceImpl, EditorGroup } from './workbench-editor.service';
import { ClientAppContribution, KeybindingContribution, KeybindingRegistry, EDITOR_COMMANDS, CommandContribution, CommandRegistry, URI, Domain, MenuContribution, MenuModelRegistry, localize, MonacoService, ServiceNames, MonacoContribution, CommandService, QuickPickService, IEventBus, isElectronRenderer, Schemas } from '@ali/ide-core-browser';
import { EditorStatusBarService } from './editor.status-bar.service';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { EditorView } from './editor.view';
import { ToolBarContribution, IToolBarViewService, ToolBarPosition } from '@ali/ide-toolbar';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { EditorGroupsResetSizeEvent, BrowserEditorContribution, IEditorActionRegistry } from './types';
import { IClientApp } from '@ali/ide-core-browser';
import { getIcon } from '@ali/ide-core-browser';
import { EditorHistoryService } from './history';
import { NavigationMenuContainer } from './navigation.view';
import { IEditorDocumentModelService } from './doc-model/types';
import * as copy from 'copy-to-clipboard';
import { FormattingSelector } from './format/formatterSelect';
import { NextMenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';

interface ResourceArgs {
  group: EditorGroup;
  uri: URI;
}

@Domain(CommandContribution, ClientAppContribution, KeybindingContribution, MonacoContribution, ComponentContribution, BrowserEditorContribution, NextMenuContribution)
export class EditorContribution implements CommandContribution, ClientAppContribution, KeybindingContribution, MonacoContribution, ComponentContribution, BrowserEditorContribution, NextMenuContribution {

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

  @Autowired(IEditorDocumentModelService)
  private editorDocumentModelService: IEditorDocumentModelService;

  @Autowired(IDocPersistentCacheProvider)
  cacheProvider: IDocPersistentCacheProvider;

  @Autowired()
  historyService: EditorHistoryService;

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-editor', {
      id: 'ide-editor',
      component: EditorView,
    });
    registry.register('breadcrumb-menu', {
      id: 'breadcrumb-menu',
      component: NavigationMenuContainer,
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
    const formatSelector = this.injector.get(FormattingSelector);
    monaco.format.FormattingConflicts._selectors.unshift(formatSelector.select.bind(formatSelector) as any);
    (monaco.services.StaticServices as any).codeEditorService = {
      get: () => {
        return codeEditorService;
      },
    }; // TODO 可能其他服务也要做类似的事情
  }

  onWillStop(app: IClientApp) {
    if (isElectronRenderer()) {
      return this.onWillStopElectron();
    } else {
      return this.workbenchEditorService.hasDirty() || !this.cacheProvider.isFlushed();
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

    if (!this.cacheProvider.isFlushed()) {
      return true;
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
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.GO_FORWARD.id,
      keybinding: 'ctrl+=',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.GO_BACK.id,
      keybinding: 'ctrl+-',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.CHANGE_LANGUAGE.id,
      keybinding: 'ctrlcmd+k m',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.SPLIT_TO_RIGHT.id,
      keybinding: 'ctrlcmd+\\',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.NAVIGATE_NEXT.id,
      keybinding: 'ctrlcmd+k ctrlcmd+right',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.NAVIGATE_PREVIOUS.id,
      keybinding: 'ctrlcmd+k ctrlcmd+left',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.SAVE_ALL.id,
      keybinding: 'alt+ctrlcmd+s',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.CLOSE_ALL_IN_GROUP.id,
      keybinding: 'ctrlcmd+k w',
      when: 'editorTitleContext',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.CLOSE_ALL.id,
      keybinding: 'ctrlcmd+k w',
      when: '!editorTitleContext',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.PIN_CURRENT.id,
      keybinding: 'ctrlcmd+k enter',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.COPY_CURRENT_PATH.id,
      keybinding: 'ctrlcmd+k p',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.REOPEN_CLOSED.id,
      keybinding: 'ctrlcmd+shift+t',
    });
    for (let i = 1; i < 10; i ++ ) {
      keybindings.registerKeybinding({
        command: EDITOR_COMMANDS.GO_TO_GROUP.id,
        keybinding: 'ctrlcmd+' + i,
        args: [i],
      });
    }
    ['left', 'up', 'down', 'right'].forEach((direction) => {
      keybindings.registerKeybinding({
        command: EDITOR_COMMANDS.MOVE_GROUP.id,
        keybinding: 'ctrlcmd+k ' + direction,
        args: [direction],
      });
    });
  }

  initialize() {
    this.editorStatusBarService.setListener();
    this.historyService.start();
  }

  registerCommands(commands: CommandRegistry): void {

    commands.registerCommand(EDITOR_COMMANDS.GO_FORWARD, {
      execute: () => {
        this.historyService.forward();
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.GO_BACK, {
      execute: () => {
        this.historyService.back();
      },
    });

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

    commands.registerCommand(EDITOR_COMMANDS.SAVE_URI, {
      execute: async (uri: URI) => {
        const docRef = this.editorDocumentModelService.getModelReference(uri);
        if (docRef && docRef.instance.dirty) {
          try {
            await docRef.instance.save();
          } catch (e) {
            docRef.dispose();
          }
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_ALL_IN_GROUP, {
      execute: async (resource: ResourceArgs) => {
        resource = resource || {};
        const {
          group = this.workbenchEditorService.currentEditorGroup,
          uri = group && group.currentResource && group.currentResource.uri,
        } = resource;
        if (group) {
          await group.closeAll();
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_SAVED, {
      execute: async (resource: ResourceArgs) => {
        resource = resource || {};
        const {
          group = this.workbenchEditorService.currentEditorGroup,
          uri = group && group.currentResource && group.currentResource.uri,
        } = resource;
        if (group) {
          await group.closeSaved();
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_OTHER_IN_GROUP, {
      execute: async (resource: ResourceArgs) => {
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
      execute: async (resource: ResourceArgs) => {
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
      execute: async (resource: ResourceArgs) => {
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

    commands.registerCommand(EDITOR_COMMANDS.PIN_CURRENT, {
      execute: () => {
        const group = this.workbenchEditorService.currentEditorGroup;
        if (group) {
          group.pinPreviewed();
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.COPY_CURRENT_PATH, {
      execute: () => {
        const resource = this.workbenchEditorService.currentResource;
        if (resource && resource.uri.scheme === Schemas.file) {
          copy(resource.uri.codeUri.fsPath);
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.SPLIT_TO_LEFT, {
      execute: async (resource: ResourceArgs) => {
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
      execute: async (resource: ResourceArgs) => {
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

    commands.registerCommand(EDITOR_COMMANDS.GO_TO_GROUP, {
      execute: async (index: number = 1) => {
        const group = this.workbenchEditorService.sortedEditorGroups[index - 1];
        if (group) {
          group.focus();
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.MOVE_GROUP, {
      execute: async (direction?: Direction) => {
        if (direction) {
          const group = this.workbenchEditorService.currentEditorGroup;
          if (group) {
            group.grid.move(direction);
          }
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.SPLIT_TO_TOP, {
      execute: async (resource: ResourceArgs) => {
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
      execute: async (resource: ResourceArgs) => {
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
          if (this.workbenchEditorService.currentEditor) {
            const currentDocModel = this.workbenchEditorService.currentEditor.currentDocumentModel;
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
        return this.workbenchEditorService.sortedEditorGroups[i].focus();
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.NAVIGATE_PREVIOUS, {
      execute: async () => {
        let i = this.workbenchEditorService.currentEditorGroup.index - 1;
        if (i < 0) {
          i = this.workbenchEditorService.editorGroups.length - 1;
        }
        return this.workbenchEditorService.sortedEditorGroups[i].focus();
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
          const nextEditorGroup = this.workbenchEditorService.sortedEditorGroups[nextEditorGroupIndex];
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
          const nextEditorGroup = this.workbenchEditorService.sortedEditorGroups[nextEditorGroupIndex];
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
      execute: async (uri?: URI) => {
        this.workbenchEditorService.closeAll(uri);
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.REOPEN_CLOSED, {
      execute: async () => {
        this.historyService.popClosed();
      },
    });
  }

  registerNextMenus(menus: IMenuRegistry) {
    menus.registerMenuItem(MenuId.EditorTitleContext, {
      command: EDITOR_COMMANDS.SPLIT_TO_LEFT.id,
      group: '9_split',
    });
    menus.registerMenuItem(MenuId.EditorTitleContext, {
      command: EDITOR_COMMANDS.SPLIT_TO_RIGHT.id,
      group: '9_split',
    });
    menus.registerMenuItem(MenuId.EditorTitleContext, {
      command: EDITOR_COMMANDS.SPLIT_TO_TOP.id,
      group: '9_split',
    });
    menus.registerMenuItem(MenuId.EditorTitleContext, {
      command: EDITOR_COMMANDS.SPLIT_TO_BOTTOM.id,
      group: '9_split',
    });
    menus.registerMenuItem(MenuId.EditorTitleContext, {
      command: {
        id: EDITOR_COMMANDS.CLOSE.id,
        label: localize('editor.title.context.close'),
      },
      group: '0_tab',
      order: 1,
    });
    menus.registerMenuItem(MenuId.EditorTitleContext, {
      command: EDITOR_COMMANDS.CLOSE_ALL_IN_GROUP.id,
      group: '0_tab',
      order: 2,
    });

    menus.registerMenuItem(MenuId.EditorTitleContext, {
      command: EDITOR_COMMANDS.CLOSE_SAVED.id,
      group: '0_tab',
      order: 3,
    });

    menus.registerMenuItem(MenuId.EditorTitleContext, {
      command: EDITOR_COMMANDS.CLOSE_OTHER_IN_GROUP.id,
      group: '0_tab',
      order: 4,
    });

    menus.registerMenuItem(MenuId.EditorTitleContext, {
      command: EDITOR_COMMANDS.CLOSE_TO_RIGHT.id,
      group: '0_tab',
      order: 5,
    });

    menus.registerMenuItem(MenuId.EditorTitle, {
      command: EDITOR_COMMANDS.CLOSE_ALL_IN_GROUP.id,
      group: '0_internal',
    });
  }

  registerEditorActions(registry: IEditorActionRegistry) {
    registry.registerEditorAction({
      iconClass: getIcon('embed'),
      title: localize('editor.splitToRight'),
      when: 'resource',
      onClick: () => {
        this.commandService.executeCommand(EDITOR_COMMANDS.SPLIT_TO_RIGHT.id);
      },
    });
  }

}
