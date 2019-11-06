import { Injectable, Autowired } from '@ali/common-di';
import { mnemonicButtonLabel } from '@ali/ide-core-common/lib/utils/strings';
import { INativeMenuTemplate, CommandService, IElectronMainMenuService, CommandRegistry} from '@ali/ide-core-common';
import { CtxMenuRenderParams, ICtxMenuRenderer } from './base';
import { MenuNode } from '../../base';
import { SeparatorMenuItemNode } from '../../menu-service';
import { electronEnv } from '../../../../utils';

export abstract class IElectronCtxMenuRenderer extends ICtxMenuRenderer {
}

@Injectable()
export class ElectronCtxMenuRenderer implements IElectronCtxMenuRenderer {

  private contextMenuActions = new Map<string, () => void>();

  @Autowired(CommandService) protected readonly commandService: CommandService;

  @Autowired(CommandRegistry) protected readonly commandRegistry: CommandRegistry;

  @Autowired(IElectronMainMenuService)
  private electronMainMenuService: IElectronMainMenuService;

  public show(params: CtxMenuRenderParams) {
    const { menuNodes, onHide, context } = params;

    // bind actions in this context
    this.contextMenuActions.clear();
    this.bindActions(menuNodes, context, this.contextMenuActions);

    const template = this.getTemplate(menuNodes);
    this.createNativeContextMenu({submenu: template}, onHide);
  }

  private bindActions(menuNodes: MenuNode[], context: any, map: Map<string, () => void>) {
    menuNodes.forEach((data) => {
      map.set(data.id, () => {
        if (typeof data.execute === 'function') {
          data.execute(context);
        }
      });
    });
  }

  private getTemplate(menuNodes: MenuNode[]): INativeMenuTemplate[] | undefined {
    return menuNodes.map((menuNode) => {
      if (menuNode.id === SeparatorMenuItemNode.ID) {
        return { type: 'separator' };
      }
      // 暂时不支持 SubmenuItem

      return {
        label: `${mnemonicButtonLabel(menuNode.label, true)} ${menuNode.isKeyCombination ? menuNode.keybinding : ''}`,
        id: menuNode.id,
        action: true,
        role: menuNode.nativeRole,
        disabled: menuNode.disabled,
        accelerator: !menuNode.isKeyCombination ? menuNode.keybinding : '',
      };
    });
    // SubmenuItem
    // TODO disabled, enabled等
  }

  createNativeContextMenu(template: INativeMenuTemplate, onHide?: () => void) {
    this.electronMainMenuService.showContextMenu(template, electronEnv.currentWebContentsId);
    if (onHide) {
      const disposer = this.electronMainMenuService.on('menuClose', (targetId, contextMenuId) => {
        if (targetId !== electronEnv.currentWebContentsId + '-context') {
          return;
        }
        if (contextMenuId === template.id) {
          disposer.dispose();
          onHide();
        }
      });
    }
    const disposer = this.electronMainMenuService.on('menuClick', (targetId, menuId) => {
      if (targetId !== electronEnv.currentWebContentsId + '-context') {
        return;
      }
      const action = this.contextMenuActions.get(menuId);
      if (action) {
        action();
      }
      disposer.dispose();
    });

  }
}

// 应该不会有这种场景?
function toElectronAccelerator(keybinding: string) {
  return keybinding.replace('ctrlcmd', 'CmdOrCtrl');
}
