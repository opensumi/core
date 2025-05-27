import { ComponentRegistryProvider, DisposableCollection } from '@opensumi/ide-core-browser';
import { SCM_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import { ResizeHandle } from '@opensumi/ide-core-browser/lib/components';
import { AbstractContextMenuService, IContextMenu, IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';
import { TabbarConfig } from '@opensumi/ide-core-browser/lib/react-providers';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';

import { EXPAND_BOTTOM_PANEL, RETRACT_BOTTOM_PANEL, TOGGLE_BOTTOM_PANEL_COMMAND } from '../main-layout.contribution';

export interface ITabbarResizeOptions {
  setSize: (targetSize?: number) => void;
  setRelativeSize: (prev: number, next: number) => void;
  getSize: () => number;
  getRelativeSize: () => number[];
  lockSize: (lock: boolean | undefined) => void;
  setMaxSize: (lock: boolean | undefined) => void;
  hidePanel: (show?: boolean) => void;
}

/**
 * 基于配置的 Tabbar 行为处理器
 * 通过配置驱动，替代复杂的策略模式
 */
export class TabbarBehaviorHandler {
  private accordionRestored: Set<string> = new Set();

  constructor(private location: string, private config?: TabbarConfig) {}

  /**
   * 获取 isLatter 配置
   */
  getIsLatter(): boolean {
    if (this.config?.isLatter !== undefined) {
      return this.config.isLatter;
    }
    // 默认配置：扩展视图和底部面板为后置位置
    return this.location === 'extendView' || this.location === 'panel';
  }

  /**
   * 包装 resize handle
   */
  wrapResizeHandle(resizeHandle: ResizeHandle): ITabbarResizeOptions {
    const { setSize, setRelativeSize, getSize, getRelativeSize, lockSize, setMaxSize, hidePanel } = resizeHandle;
    const isLatter = this.getIsLatter();

    return {
      setSize: (size) => setSize(size, isLatter),
      setRelativeSize: (prev: number, next: number) => setRelativeSize(prev, next, isLatter),
      getSize: () => getSize(isLatter),
      getRelativeSize: () => getRelativeSize(isLatter),
      setMaxSize: (lock: boolean | undefined) => setMaxSize(lock, isLatter),
      lockSize: (lock: boolean | undefined) => lockSize(lock, isLatter),
      hidePanel: (show) => hidePanel(show),
    };
  }

  /**
   * 注册特定位置的命令（基于配置）
   */
  registerLocationSpecificCommands(context: {
    commandRegistry: any;
    layoutService: IMainLayoutService;
  }): DisposableCollection {
    const disposables = new DisposableCollection();
    const { supportedActions } = this.config || {};

    // 如果支持展开操作，注册相关命令
    if (supportedActions?.expand) {
      disposables.push(
        context.commandRegistry.registerCommand(EXPAND_BOTTOM_PANEL, {
          execute: () => {
            context.layoutService.expandBottom(true);
          },
        }),
      );

      disposables.push(
        context.commandRegistry.registerCommand(RETRACT_BOTTOM_PANEL, {
          execute: () => {
            context.layoutService.expandBottom(false);
          },
        }),
      );
    }

    // 如果支持 toggle 操作，注册相关命令
    if (supportedActions?.toggle) {
      disposables.push(
        context.commandRegistry.registerCommand(TOGGLE_BOTTOM_PANEL_COMMAND, {
          execute: (show?: boolean, size?: number) => {
            context.layoutService.toggleSlot(this.location, show, size);
          },
        }),
      );
    }

    return disposables;
  }

  /**
   * 注册特定位置的菜单（基于配置）
   */
  registerLocationSpecificMenus(context: {
    menuRegistry: IMenuRegistry;
    ctxMenuService: AbstractContextMenuService;
  }): IContextMenu | undefined {
    // 如果支持展开操作，注册相关菜单
    const menuItems: any[] = [];

    if (this.config?.supportedActions?.expand) {
      menuItems.push(
        {
          command: EXPAND_BOTTOM_PANEL.id,
          group: 'navigation',
          when: '!bottomFullExpanded',
          order: 1,
        },
        {
          command: RETRACT_BOTTOM_PANEL.id,
          group: 'navigation',
          when: 'bottomFullExpanded',
          order: 1,
        },
      );
    }

    if (this.config?.supportedActions?.toggle) {
      menuItems.push({
        command: TOGGLE_BOTTOM_PANEL_COMMAND.id,
        group: 'navigation',
        order: 2,
      });
    }

    if (menuItems.length > 0) {
      context.menuRegistry.registerMenuItems(`tabbar/${this.location}/common`, menuItems);

      return context.ctxMenuService.createMenu({
        id: `tabbar/${this.location}/common`,
      });
    }

    return undefined;
  }

  /**
   * 处理展开/收缩逻辑（基于配置）
   */
  doExpand(expand: boolean, resizeHandle?: ITabbarResizeOptions): void {
    if (!this.config?.supportedActions?.expand || !resizeHandle) {
      return;
    }

    const { setRelativeSize } = resizeHandle;
    const isLatter = this.getIsLatter();

    if (expand) {
      if (isLatter) {
        // 后置位置：完全展开
        setRelativeSize(0, 1);
      } else {
        // 前置位置：完全展开
        setRelativeSize(1, 0);
      }
    } else {
      // 恢复正常尺寸
      setRelativeSize(2, 1);
    }
  }

  /**
   * 判断是否处于展开状态（基于配置）
   */
  isExpanded(resizeHandle?: ITabbarResizeOptions): boolean {
    if (!this.config?.supportedActions?.expand || !resizeHandle) {
      return false;
    }

    const { getRelativeSize } = resizeHandle;
    const relativeSizes = getRelativeSize().join(',');
    const isLatter = this.getIsLatter();

    return isLatter ? relativeSizes === '0,1' : relativeSizes === '1,0';
  }

  /**
   * 激活快捷键的处理逻辑（基于配置）
   */
  handleActivateKeyBinding(
    containerId: string,
    currentContainerId: string,
    updateCurrentContainerId: (id: string) => void,
    forceShow?: boolean,
  ): void {
    // 如果支持 toggle，根据当前状态切换
    if (this.config?.supportedActions?.toggle && !forceShow) {
      updateCurrentContainerId(currentContainerId === containerId ? '' : containerId);
    } else {
      // 否则直接激活
      updateCurrentContainerId(containerId);
    }
  }

  /**
   * 处理全展开状态（基于配置）
   */
  handleFullExpanded(
    currentId: string,
    isCurrentExpanded: boolean,
    resizeHandle: ITabbarResizeOptions,
    options: { barSize: number; panelSize: number; prevSize?: number },
  ): void {
    const { barSize, panelSize, prevSize } = options;
    const { setRelativeSize, setSize } = resizeHandle;

    if (currentId) {
      if (isCurrentExpanded && this.config?.supportedActions?.expand) {
        const isLatter = this.getIsLatter();
        if (isLatter) {
          setRelativeSize(0, 1);
        } else {
          setRelativeSize(1, 0);
        }
      } else {
        setSize(prevSize || panelSize + barSize);
      }
    } else {
      setSize(barSize);
    }
  }

  /**
   * 尝试恢复手风琴尺寸（基于配置）
   */
  tryRestoreAccordionSize(containerInfo: ComponentRegistryProvider, layoutService: IMainLayoutService): void {
    // 如果不支持手风琴，直接返回
    if (!this.config?.supportedActions?.accordion) {
      return;
    }

    const { containerId } = containerInfo.options || {};
    if (!containerId || this.accordionRestored.has(containerId)) {
      return;
    }

    // 使用自定义视图取代手风琴的面板不需要 restore
    // scm 视图例外，因为在新版本 Gitlens 中可以将自己注册到 scm 中
    if (
      (!containerInfo || containerInfo.options?.component) &&
      containerInfo?.options?.containerId !== SCM_CONTAINER_ID
    ) {
      return;
    }

    const accordionService = layoutService.getAccordionService(containerId);
    accordionService.restoreState();
    this.accordionRestored.add(containerId);
  }
}
