import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import {  IClientApp, ClientAppContribution, KeybindingContribution, KeybindingRegistry, EDITOR_COMMANDS, CommandContribution, CommandRegistry, URI, Domain, localize, MonacoService, ServiceNames, MonacoContribution, CommandService, QuickPickService, IEventBus, isElectronRenderer, Schemas, PreferenceService, Disposable, IPreferenceSettingsService, OpenerContribution, IOpenerService, IClipboardService, QuickOpenContribution, IQuickOpenHandlerRegistry, PrefixQuickOpenService, MonacoOverrideServiceRegistry, IContextKeyService } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { isElectronEnv, isWindows, isOSX, PreferenceScope, ILogger } from '@ali/ide-core-common';
import { MenuContribution, IMenuRegistry, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { SUPPORTED_ENCODINGS } from '@ali/ide-core-common/lib/const';

import { WorkbenchEditorService, IResourceOpenOptions, EditorGroupSplitAction, ILanguageService, Direction, ResourceService, IDocPersistentCacheProvider, IEditor, SaveReason } from '../common';
import { EditorGroupsResetSizeEvent, BrowserEditorContribution, IEditorFeatureRegistry } from './types';
import { WorkbenchEditorServiceImpl, EditorGroup } from './workbench-editor.service';
import { EditorStatusBarService } from './editor.status-bar.service';
import { EditorView } from './editor.view';
import { EditorHistoryService } from './history';
import { NavigationMenuContainer } from './navigation.view';
import { IEditorDocumentModelService } from './doc-model/types';
import { FormattingSelector } from './format/formatterSelect';
import { EditorTopPaddingContribution } from './view/topPadding';
import { EditorSuggestWidgetContribution } from './view/suggest-widget';
import { EditorOpener } from './editor-opener';
import { WorkspaceSymbolQuickOpenHandler } from './language/workspace-symbol-quickopen';
import { AUTO_SAVE_MODE } from '../common/editor';
import { EOL } from '@ali/ide-monaco/lib/browser/monaco-api/types';

interface ResourceArgs {
  group: EditorGroup;
  uri: URI;
}

@Domain(CommandContribution, ClientAppContribution, KeybindingContribution, MonacoContribution, ComponentContribution, MenuContribution, OpenerContribution, QuickOpenContribution)
export class EditorContribution implements CommandContribution, ClientAppContribution, KeybindingContribution, MonacoContribution, ComponentContribution, MenuContribution, OpenerContribution, QuickOpenContribution {

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

  @Autowired(IEditorDocumentModelService)
  private editorDocumentModelService: IEditorDocumentModelService;

  @Autowired(IDocPersistentCacheProvider)
  cacheProvider: IDocPersistentCacheProvider;

  @Autowired()
  historyService: EditorHistoryService;

  @Autowired()
  monacoService: MonacoService;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired()
  private editorOpener: EditorOpener;

  @Autowired(IClipboardService)
  private readonly clipboardService: IClipboardService;

  @Autowired()
  private readonly workspaceSymbolQuickOpenHandler: WorkspaceSymbolQuickOpenHandler;

  @Autowired(PrefixQuickOpenService)
  private readonly prefixQuickOpenService: PrefixQuickOpenService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

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

  registerOverrideService(registry: MonacoOverrideServiceRegistry): void {
    const { MonacoCodeService, MonacoContextViewService } = require('./editor.override');
    const { MonacoTextModelService } = require('./doc-model/override');
    const codeEditorService = this.injector.get(MonacoCodeService);

    // Monaco Editor ContextKeyService
    // 经过这个Override, 所有编辑器的 contextKeyService 都是 editorContextKeyService 的孩子
    const globalContextKeyService: IContextKeyService = this.injector.get(IContextKeyService);
    const editorContextKeyService = globalContextKeyService.createScoped();
    this.workbenchEditorService.setEditorContextKeyService(editorContextKeyService);
    registry.registerOverrideService(ServiceNames.CONTEXT_KEY_SERVICE, (editorContextKeyService as any).contextKeyService);

    // Monaco CodeEditorService
    registry.registerOverrideService(ServiceNames.CODE_EDITOR_SERVICE, codeEditorService);

    // Monaco ContextViewService
    registry.registerOverrideService(ServiceNames.CONTEXT_VIEW_SERVICE, this.injector.get(MonacoContextViewService));

    // Monaco TextModelService
    registry.registerOverrideService(ServiceNames.TEXT_MODEL_SERVICE, this.injector.get(MonacoTextModelService));

  }

  registerMonacoDefaultFormattingSelector(register): void {
    const formatSelector = this.injector.get(FormattingSelector);
    register(formatSelector.select.bind(formatSelector));
  }

  protected async interceptOpen(uri: URI) {
    try {
      await this.openerService.open(uri);
      return true;
    } catch (e) {
      this.logger.error(e);
      return false;
    }
  }

  onWillStop(app: IClientApp) {
    if (isElectronRenderer()) {
      return this.onWillStopElectron();
    } else {
      return this.workbenchEditorService.hasDirty() || !this.cacheProvider.isFlushed();
    }
  }

  // editorTitle出现了参数不统一。。
  private extractGroupAndUriFromArgs(resource: ResourceArgs | URI, editorGroup?: EditorGroup): {
    group?: EditorGroup,
    uri?: URI,
  } {
    let group: EditorGroup;
    let uri: URI;
    if (resource instanceof URI) {
      group = editorGroup || this.workbenchEditorService.currentEditorGroup;
      uri = resource || (group && group.currentResource && group.currentResource.uri);
    } else {
      const resourceArgs = resource || {};
      group = resourceArgs.group || this.workbenchEditorService.currentEditorGroup;
      uri = resourceArgs.uri || (group && group.currentResource && group.currentResource.uri);
    }
    return {
      group,
      uri,
    };
  }

  async onWillStopElectron() {
    for (const group of this.workbenchEditorService.editorGroups) {
      for (const resource of group.resources) {
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
      keybinding: isElectronEnv() ? 'ctrlcmd+w' : 'alt+shift+w',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.PREVIOUS.id,
      keybinding: isElectronEnv() ? 'alt+cmd+left' : 'ctrlcmd+ctrl+left',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.NEXT.id,
      keybinding: isElectronEnv() ? 'alt+cmd+right' : 'ctrlcmd+ctrl+right',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.PREVIOUS.id,
      keybinding: isElectronEnv() ? 'ctrlcmd+pageup' : 'alt+pageup',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.NEXT.id,
      keybinding: isElectronEnv() ? 'ctrlcmd+pagedown' : 'alt+pagedown',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.GO_FORWARD.id,
      keybinding: isWindows ? 'alt+right' : 'ctrl+shift+-',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.GO_BACK.id,
      keybinding: isWindows ? 'alt+left' : 'ctrl+-',
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
      keybinding: isElectronEnv() ? 'ctrlcmd+shift+t' : 'alt+shift+t',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.NEW_UNTITLED_FILE.id,
      keybinding: isElectronEnv() ? 'ctrlcmd+n' : 'alt+n',
    });
    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.SEARCH_WORKSPACE_SYMBOL.id,
      keybinding: isElectronEnv() ? 'ctrlcmd+t' : 'ctrlcmd+o',
    });
    if (isElectronEnv()) {
      keybindings.registerKeybinding({
        command: EDITOR_COMMANDS.NEXT.id,
        keybinding: 'ctrl+tab',
      });
      keybindings.registerKeybinding({
        command: EDITOR_COMMANDS.PREVIOUS.id,
        keybinding: 'ctrl+shift+tab',
      });
      if (isOSX) {
        keybindings.registerKeybinding({
          command: EDITOR_COMMANDS.NEXT.id,
          keybinding: 'ctrlcmd+shift+]',
        });
        keybindings.registerKeybinding({
          command: EDITOR_COMMANDS.PREVIOUS.id,
          keybinding: 'ctrlcmd+shift+[',
        });
      }
    }
    for (let i = 1; i < 10; i++) {
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

    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.COMPONENT_UNDO.id,
      keybinding: 'ctrlcmd+z',
      when: 'inEditorComponent',
    });

    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.COMPONENT_REDO.id,
      keybinding: 'shift+ctrlcmd+z',
      when: 'inEditorComponent',
    });

    keybindings.registerKeybinding({
      command: EDITOR_COMMANDS.TOGGLE_WORD_WRAP.id,
      keybinding: 'alt+z',
      when: 'editorFocus',
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
      execute: async (uri: URI, options?: IResourceOpenOptions) => {
        const openResult = await this.workbenchEditorService.open(uri, options);
        if (openResult) {
          return {
            groupId: openResult?.group.name,
          };
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.OPEN_RESOURCES, {
      execute: ({ uris }: { uris: URI[] }) => {
        this.workbenchEditorService.openUris(uris);
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.COMPARE, {
      execute: ({ original, modified, name }: { original: URI, modified: URI, name?: string }, options: IResourceOpenOptions = {}) => {
        name = name || `${original.displayName} <=> ${modified.displayName}`;
        return this.workbenchEditorService.open(
          URI.from({
            scheme: 'diff',
            query: URI.stringifyQuery({
              name,
              original,
              modified,
            }),
          }),
          options);
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.SAVE_CURRENT, {
      execute: async () => {
        const group = this.workbenchEditorService.currentEditorGroup;
        if (group && group.currentResource) {
          group.pin(group.currentResource!.uri);
          group.saveCurrent();
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.SAVE_URI, {
      execute: async (uri: URI) => {
        for (const g of this.workbenchEditorService.editorGroups) {
          const r = g.resources.find((r) => r.uri.isEqual(uri));
          if (r) {
            g.saveResource(r);
          }
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CLOSE_ALL_IN_GROUP, {
      execute: async (args0: ResourceArgs | URI, args1?: EditorGroup) => {
        const {
          group,
        } = this.extractGroupAndUriFromArgs(args0, args1);
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

    commands.registerCommand(EDITOR_COMMANDS.GET_CURRENT_RESOURCE, {
      execute: () => this.workbenchEditorService.currentResource,
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
          this.clipboardService.writeText(resource.uri.codeUri.fsPath);
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
          await group.split(EditorGroupSplitAction.Left, uri, { focus: true });
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.SPLIT_TO_RIGHT, {
      execute: async (resource: ResourceArgs | URI, editorGroup?: EditorGroup) => {
        const { group, uri } = this.extractGroupAndUriFromArgs(resource, editorGroup);

        if (group && uri) {
          await group.split(EditorGroupSplitAction.Right, uri, { focus: true });
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.GO_TO_GROUP, {
      execute: async (index: number = 1) => {
        const group = this.workbenchEditorService.sortedEditorGroups[index - 1];
        if (group) {
          group.focus();
          return;
        }

        // 如果找的索引比 editorGroups 的数量大1，就向右拆分一个
        const groupLength = this.workbenchEditorService.sortedEditorGroups.length;
        if (groupLength === (index - 1)) {
          const rightEditorGroup = this.workbenchEditorService.sortedEditorGroups[groupLength - 1];
          const uri = rightEditorGroup?.currentResource?.uri;

          if (rightEditorGroup && uri) {
            await rightEditorGroup.split(EditorGroupSplitAction.Right, uri, { focus: true });
          }
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

    commands.registerCommand(EDITOR_COMMANDS.FOCUS_ACTIVE_EDITOR_GROUP, {
      execute: async () => {
        const group = this.workbenchEditorService.currentEditorGroup;
        if (group) {
          group.focus();
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
          await group.split(EditorGroupSplitAction.Top, uri, { focus: true });
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
          await group.split(EditorGroupSplitAction.Bottom, uri, { focus: true });
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
        const targetLanguageId = await this.quickPickService.show(allLanguageItems, {
          placeholder: localize('editor.changeLanguageId'),
          selectIndex: () => allLanguageItems.findIndex((item) => item.value === this.workbenchEditorService.currentCodeEditor?.currentDocumentModel?.languageId),
        });
        if (targetLanguageId && currentLanguageId !== targetLanguageId) {
          if (this.workbenchEditorService.currentEditor) {
            const currentDocModel = this.workbenchEditorService.currentEditor.currentDocumentModel;
            if (currentDocModel) {
              this.editorDocumentModelService.changeModelOptions(currentDocModel.uri, {
                languageId: targetLanguageId,
              });
            }
          }
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CHANGE_ENCODING, {
      execute: async () => {
        const resource = this.workbenchEditorService.currentResource;
        if (resource) {
          const encodingItems = Object.keys(SUPPORTED_ENCODINGS).map((encoding) => ({
            label: SUPPORTED_ENCODINGS[encoding].labelLong,
            value: encoding,
            description: SUPPORTED_ENCODINGS[encoding].labelShort,
          }));
          const encoding = await this.quickPickService.show(encodingItems, {
            placeholder: localize('editor.chooseEncoding'),
          });
          if (encoding) {
            this.editorDocumentModelService.changeModelOptions(resource.uri, {
              encoding,
            });
          }
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.CHANGE_EOL, {
      execute: async () => {
        const resource = this.workbenchEditorService.currentResource;
        const currentCodeEditor = this.workbenchEditorService.currentCodeEditor;
        if (currentCodeEditor && currentCodeEditor.currentDocumentModel && resource) {
          const res: EOL | undefined = await this.quickPickService.show([
            {label: 'LF', value: EOL.LF},
            {label: 'CRLF', value: EOL.CRLF},
          ], {
            placeholder: localize('editor.changeEol'),
            selectIndex: () => currentCodeEditor.currentDocumentModel!.eol === EOL.LF ? 0 : 1,
          });
          if (res) {
            this.editorDocumentModelService.changeModelOptions(resource.uri, {
              eol: res,
            });
          }
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.FOCUS, {
      execute: async () => {
        if (this.workbenchEditorService.currentEditor) {
          this.workbenchEditorService.currentEditor.monacoEditor.focus();
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
          return editorGroup.open(editorGroup.resources[index].uri, { focus: true });
        } else {
          return editorGroup.open(editorGroup.resources[0].uri, { focus: true });
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.NEXT_IN_GROUP, {
      execute: async () => {
        const editorGroup = this.workbenchEditorService.currentEditorGroup;
        if (!editorGroup.currentResource) {
          return;
        }
        const index = editorGroup.resources.findIndex((r) => r.uri.isEqual(editorGroup.currentResource!.uri)) + 1;
        if (editorGroup.resources[index]) {
          return editorGroup.open(editorGroup.resources[index].uri, {focus: true});
        } else {
          return editorGroup.open(editorGroup.resources[editorGroup.resources.length - 1].uri, {focus: true});
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
          return editorGroup.open(editorGroup.resources[index].uri, {focus: true});
        } else {
          const nextEditorGroupIndex = editorGroup.index === this.workbenchEditorService.editorGroups.length - 1 ? 0 : editorGroup.index + 1;
          const nextEditorGroup = this.workbenchEditorService.sortedEditorGroups[nextEditorGroupIndex];
          nextEditorGroup.focus();
          return nextEditorGroup.open(nextEditorGroup.resources[0].uri, {focus: true});
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
          return editorGroup.open(editorGroup.resources[index].uri, {focus: true});
        } else {
          const nextEditorGroupIndex = editorGroup.index === 0 ? this.workbenchEditorService.editorGroups.length - 1 : editorGroup.index - 1;
          const nextEditorGroup = this.workbenchEditorService.sortedEditorGroups[nextEditorGroupIndex];
          nextEditorGroup.focus();
          return nextEditorGroup.open(nextEditorGroup.resources[nextEditorGroup.resources.length - 1].uri, {focus: true});
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.LAST_IN_GROUP, {
      execute: async () => {
        const editorGroup = this.workbenchEditorService.currentEditorGroup;
        if (editorGroup.resources.length > 0) {
          return editorGroup.open(editorGroup.resources[editorGroup.resources.length - 1].uri, {focus: true});
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
          await editorGroup.open(target.uri, {focus: true});
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
      execute: async (reason?: SaveReason) => {
        this.workbenchEditorService.saveAll(undefined, reason);
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

    commands.registerCommand(EDITOR_COMMANDS.NEW_UNTITLED_FILE, {
      execute: () => {
        this.workbenchEditorService.createUntitledResource();
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.COMPONENT_UNDO, {
      execute: () => {
        this.workbenchEditorService.currentEditorGroup.componentUndo();
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.COMPONENT_REDO, {
      execute: () => {
        this.workbenchEditorService.currentEditorGroup.componentRedo();
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.TEST_TOKENIZE, {
      execute: () => {
        const currentCodeEditor = this.workbenchEditorService.currentCodeEditor;
        if (currentCodeEditor) {
          const selections = currentCodeEditor.getSelections();
          if (selections && selections.length > 0 && currentCodeEditor.currentDocumentModel) {
            const {
              selectionStartLineNumber,
              selectionStartColumn,
              positionLineNumber,
              positionColumn,
            } = selections[0];
            const selectionText = currentCodeEditor.currentDocumentModel.getText(
              new monaco.Range(
                selectionStartLineNumber,
                selectionStartColumn,
                positionLineNumber,
                positionColumn,
              ),
            );

            this.monacoService.testTokenize(selectionText, currentCodeEditor.currentDocumentModel.languageId);
          }
        }
      },
    });

    commands.registerCommand(EDITOR_COMMANDS.SEARCH_WORKSPACE_SYMBOL, {
      execute: () => this.prefixQuickOpenService.open('#'),
    });

    commands.registerCommand(EDITOR_COMMANDS.TOGGLE_WORD_WRAP, {
      execute: () => {
        const wordWrap = this.preferenceService.get<string>('editor.wordWrap');

        if (wordWrap) {
          const values: string[] = ['off', 'on'];
          const index = values.indexOf(wordWrap) + 1;
          if (index > -1) {
            this.preferenceService.set('editor.wordWrap', values[index % values.length], PreferenceScope.User);
          }
        }
      },
    });
  }

  registerMenus(menus: IMenuRegistry) {
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

    menus.registerMenuItem(MenuId.EditorTitle, {
      command: EDITOR_COMMANDS.SPLIT_TO_RIGHT.id,
      group: 'navigation',
      when: 'resource',
      order: 5,
    });
  }

  registerOpener(regisry: IOpenerService) {
    regisry.registerOpener(this.editorOpener);
  }

  registerQuickOpenHandlers(handlers: IQuickOpenHandlerRegistry): void {
    handlers.registerHandler(this.workspaceSymbolQuickOpenHandler);
  }

}

@Domain(BrowserEditorContribution, CommandContribution)
export class EditorAutoSaveEditorContribution implements BrowserEditorContribution, CommandContribution {
  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(IEditorDocumentModelService)
  editorDocumentService: IEditorDocumentModelService;

  @Autowired(IPreferenceSettingsService)
  preferenceSettings: IPreferenceSettingsService;

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        const disposable = new Disposable();
        disposable.addDispose(editor.monacoEditor.onDidBlurEditorWidget(() => {
          if (this.preferenceService.get('editor.autoSave') === AUTO_SAVE_MODE.EDITOR_FOCUS_CHANGE) {
            if (editor.currentDocumentModel && !editor.currentDocumentModel.closeAutoSave && editor.currentDocumentModel.dirty && editor.currentDocumentModel.savable) {
              editor.currentDocumentModel.save(undefined, SaveReason.FocusOut);
            }
          }
        }));
        disposable.addDispose(editor.monacoEditor.onDidChangeModel((e) => {
          if (this.preferenceService.get('editor.autoSave') === AUTO_SAVE_MODE.EDITOR_FOCUS_CHANGE) {
            if (e.oldModelUrl) {
              const oldUri = new URI(e.oldModelUrl.toString());
              const docRef = this.editorDocumentService.getModelReference(oldUri, 'editor-focus-autosave');
              if (docRef && !docRef.instance.closeAutoSave && docRef.instance.dirty && docRef.instance.savable) {
                docRef.instance.save(undefined, SaveReason.FocusOut);
                docRef.dispose();
              }
            }
          }
        }));
        return disposable;
      },
    });
    window.addEventListener('blur', () => {
      if (this.preferenceService.get('editor.autoSave') === AUTO_SAVE_MODE.WINDOWS_LOST_FOCUS) {
        this.commandService.executeCommand(EDITOR_COMMANDS.SAVE_ALL.id, SaveReason.FocusOut);
      }
    });
    this.preferenceSettings.setEnumLabels('editor.autoSave', {
      [AUTO_SAVE_MODE.OFF] : localize('editor.autoSave.enum.off'),
      [AUTO_SAVE_MODE.AFTER_DELAY]: localize('editor.autoSave.enum.afterDelay'),
      [AUTO_SAVE_MODE.EDITOR_FOCUS_CHANGE]: localize('editor.autoSave.enum.editorFocusChange'),
      [AUTO_SAVE_MODE.WINDOWS_LOST_FOCUS]: localize('editor.autoSave.enum.windowLostFocus'),
    });
    registry.registerEditorFeatureContribution(new EditorTopPaddingContribution());
    registry.registerEditorFeatureContribution(this.injector.get(EditorSuggestWidgetContribution));
    this.registerAutoSaveConfigurationChange();
  }

  registerAutoSaveConfigurationChange() {
    this.preferenceService.onSpecificPreferenceChange('editor.autoSave', (change) => {
      const mode = change.newValue;
      if (mode !== AUTO_SAVE_MODE.OFF) {
        // 只有两种原因：丢失焦点和延迟保存，非此即彼
        let reason = SaveReason.FocusOut;
        if (mode === AUTO_SAVE_MODE.AFTER_DELAY) {
          reason = SaveReason.AfterDelay;
        }
        // 只保存被该设置影响的文档
        // 比如在当前工作区写代码，然后打开了一个 ~/.xxx 文件
        // 然后用户修改了设置，这里就只保存当前工作区的文件。
        for (const group of this.workbenchEditorService.editorGroups) {
          for (const resource of group.resources) {
            if (change.affects(resource?.uri.toString())) {
              group.saveResource(resource, reason);
            }
          }
        }
      }
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(EDITOR_COMMANDS.AUTO_SAVE, {
      execute: () => {
        const autoSavePreferenceField = 'editor.autoSave';
        const value = this.preferenceSettings.getPreference(autoSavePreferenceField, PreferenceScope.User).value as string || AUTO_SAVE_MODE.OFF;
        const nextValue = [
          AUTO_SAVE_MODE.AFTER_DELAY,
          AUTO_SAVE_MODE.EDITOR_FOCUS_CHANGE,
          AUTO_SAVE_MODE.WINDOWS_LOST_FOCUS,
        ].includes(value) ? AUTO_SAVE_MODE.OFF : AUTO_SAVE_MODE.AFTER_DELAY;

        return this.preferenceSettings.setPreference(autoSavePreferenceField, nextValue, PreferenceScope.User);
      },
    });
  }

}
