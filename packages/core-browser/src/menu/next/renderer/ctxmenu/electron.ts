import { Autowired, Injectable } from '@opensumi/di';
import {
  CommandService,
  Disposable,
  IElectronMainMenuService,
  INativeMenuTemplate,
  strings,
} from '@opensumi/ide-core-common';

import { SpecialCases } from '../../../../keyboard';
import { electronEnv } from '../../../../utils';
import { MenuNode } from '../../base';
import { AbstractContextMenuService, SeparatorMenuItemNode, SubmenuItemNode } from '../../menu.interface';
import { AbstractMenubarService } from '../../menubar-service';

import { CtxMenuRenderParams, ICtxMenuRenderer } from './base';

export abstract class IElectronCtxMenuRenderer extends ICtxMenuRenderer {}

export const IElectronMenuFactory = Symbol('IElectronMenuFactory');

export const IElectronMenuBarService = Symbol('IElectronMenuBarService');

export interface IElectronMenuBarService {
  start();
}

@Injectable()
export class ElectronMenuFactory extends Disposable {
  public getTemplate(
    menuNodes: MenuNode[],
    menuMap: Map<string, () => void>,
    context?: any[],
  ): INativeMenuTemplate[] | undefined {
    return menuNodes.map((menuNode, index) => {
      if (menuNode.id === SeparatorMenuItemNode.ID) {
        return { type: 'separator' };
      }
      if (menuNode.id === SubmenuItemNode.ID) {
        const submenuTemplate = this.getTemplate(menuNode.children, menuMap, context);
        return {
          label: `${strings.mnemonicButtonLabel(menuNode.label, true)}`,
          submenu: Array.isArray(submenuTemplate) && submenuTemplate.length ? submenuTemplate : undefined,
        };
      } else {
        this.bindAction(menuNode, menuMap, index, context);
        return {
          type: menuNode.checked ? 'checkbox' : undefined,
          checked: menuNode.checked ? menuNode.checked : false,
          label: `${strings.mnemonicButtonLabel(menuNode.label, true)} ${
            menuNode.isKeyCombination ? menuNode.keybinding : ''
          }`,
          id: `${menuNode.id}-${index}`,
          action: true,
          role: menuNode.nativeRole,
          disabled: menuNode.disabled,
          accelerator:
            menuNode.rawKeybinding && !menuNode.isKeyCombination
              ? toElectronAccelerator(menuNode.rawKeybinding)
              : undefined,
        };
      }
    });
  }

  private bindAction(menuNode: MenuNode, map: Map<string, () => void>, index: number, context?: any[]) {
    if (typeof menuNode.execute === 'function') {
      map.set(`${menuNode.id}-${index}`, () => {
        menuNode.execute(context);
      });
    }
  }
}

@Injectable()
export class ElectronCtxMenuRenderer implements IElectronCtxMenuRenderer {
  private contextMenuActions = new Map<string, () => void>();

  @Autowired(CommandService) protected readonly commandService: CommandService;

  @Autowired(IElectronMainMenuService)
  private electronMainMenuService: IElectronMainMenuService;

  @Autowired(IElectronMenuFactory)
  factory: ElectronMenuFactory;

  @Autowired(AbstractContextMenuService)
  private readonly menuService: AbstractContextMenuService;

  public show(payload: CtxMenuRenderParams) {
    const { onHide, args: context } = payload;

    let menuNodes: MenuNode[];
    if (typeof payload.menuNodes === 'string') {
      const menus = this.menuService.createMenu({
        id: payload.menuNodes,
        config: {
          args: payload.args,
        },
        contextKeyService: payload.contextKeyService,
      });
      menuNodes = menus.getMergedMenuNodes();
      menus.dispose();
    } else {
      menuNodes = payload.menuNodes;
    }

    // bind actions in this context
    this.contextMenuActions.clear();
    const template = this.factory.getTemplate(menuNodes, this.contextMenuActions, context);
    this.createNativeContextMenu({ submenu: template }, onHide);
  }

  createNativeContextMenu(template: INativeMenuTemplate, onHide?: (canceled) => void) {
    this.electronMainMenuService.showContextMenu(template, electronEnv.currentWebContentsId);
    const disposer = new Disposable();
    disposer.addDispose(
      this.electronMainMenuService.on('menuClose', (targetId, contextMenuId) => {
        if (targetId !== electronEnv.currentWebContentsId + '-context') {
          return;
        }
        disposer.dispose();
        if (onHide) {
          onHide(true);
        }
      }),
    );

    disposer.addDispose(
      this.electronMainMenuService.on('menuClick', (targetId, menuId) => {
        if (targetId !== electronEnv.currentWebContentsId + '-context') {
          return;
        }
        const action = this.contextMenuActions.get(menuId);
        if (action) {
          action();
        }
        if (onHide) {
          onHide(false);
        }
        disposer.dispose();
      }),
    );
  }
}

function toElectronAccelerator(keybinding: string) {
  return keybinding
    .replace('ctrlcmd', 'CmdOrCtrl')
    .replace(SpecialCases.MACMETA, 'CmdOrCtrl')
    .replace(SpecialCases.CTRL, 'Ctrl')
    .replace(SpecialCases.SHIFT, 'Shift')
    .replace(SpecialCases.ALT, 'Alt');
}

@Injectable()
export class ElectronMenuBarService implements IElectronMenuBarService {
  private menuBarActions = new Map<string, () => void>();

  @Autowired(CommandService) protected readonly commandService: CommandService;

  @Autowired(AbstractMenubarService)
  menubarService: AbstractMenubarService;

  @Autowired(IElectronMainMenuService)
  private electronMainMenuService: IElectronMainMenuService;

  @Autowired(IElectronMenuFactory)
  factory: ElectronMenuFactory;

  start() {
    this.electronMainMenuService.on('menuClick', (targetId, menuId) => {
      if (targetId !== electronEnv.currentWindowId + '-app') {
        return;
      }
      const action = this.menuBarActions.get(menuId);
      if (action) {
        action();
      }
    });
    this.updateMenuBar();
    // 同时监听 onDidMenuBarChange/onDidMenuChange
    this.menubarService.onDidMenubarChange(() => {
      this.updateMenuBar();
    });
    this.menubarService.onDidMenuChange(() => {
      this.updateMenuBar();
    });
  }

  updateMenuBar() {
    this.menuBarActions.clear();
    const menubarItems = this.menubarService.getMenubarItems();
    const appMenuTemplate: INativeMenuTemplate[] = [];
    menubarItems.forEach((item) => {
      const menuId = item.id;
      const menuNodes = this.menubarService.getMenuNodes(menuId);
      const templates = this.factory.getTemplate(menuNodes, this.menuBarActions);
      if (templates && templates.length > 0) {
        const template: INativeMenuTemplate = {
          label: strings.mnemonicButtonLabel(item.label, true),
          submenu: templates,
        };
        if (item.nativeRole) {
          template.role = item.nativeRole;
        }
        appMenuTemplate.push(template);
      }
    });
    this.electronMainMenuService.setApplicationMenu({ submenu: appMenuTemplate }, electronEnv.currentWindowId);
  }
}
