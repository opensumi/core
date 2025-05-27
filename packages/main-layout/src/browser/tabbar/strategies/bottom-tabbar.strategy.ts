import { CommandRegistry, DisposableCollection } from '@opensumi/ide-core-browser';
import { ResizeHandle } from '@opensumi/ide-core-browser/lib/components';
import { AbstractContextMenuService, IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';
import { TabbarConfig } from '@opensumi/ide-core-browser/lib/react-providers';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';

import { BaseTabbarStrategy, ITabbarResizeOptions } from './base-tabbar.strategy';

/**
 * 底部 tabbar 策略（适用于 panel 位置）
 */
export class BottomTabbarStrategy extends BaseTabbarStrategy {
  constructor(tabbarConfig?: TabbarConfig) {
    super('panel', tabbarConfig);
  }

  registerLocationSpecificCommands(context: {
    commandRegistry: CommandRegistry;
    layoutService: IMainLayoutService;
  }): DisposableCollection {
    const { commandRegistry, layoutService } = context;
    const disposables = new DisposableCollection();

    // 注册底部面板特有的展开/收缩命令
    disposables.push(
      commandRegistry.registerCommand(
        { id: 'workbench.action.toggleBottomPanelExpanded' },
        {
          execute: () => {
            layoutService.expandBottom(true);
          },
        },
      ),
    );

    disposables.push(
      commandRegistry.registerCommand(
        { id: 'workbench.action.retractBottomPanel' },
        {
          execute: () => {
            layoutService.expandBottom(false);
          },
        },
      ),
    );

    disposables.push(
      commandRegistry.registerCommand(
        { id: 'workbench.action.toggleBottomPanel' },
        {
          execute: (show?: boolean, size?: number) => {
            layoutService.toggleSlot('panel', show, size);
          },
        },
      ),
    );

    return disposables;
  }

  registerLocationSpecificMenus(context: { menuRegistry: IMenuRegistry; ctxMenuService: AbstractContextMenuService }) {
    const { menuRegistry, ctxMenuService } = context;

    // 注册底部面板特有的菜单
    menuRegistry.registerMenuItems('tabbar/bottom/common', [
      {
        command: 'workbench.action.toggleBottomPanelExpanded',
        group: 'navigation',
        when: '!bottomFullExpanded',
        order: 1,
      },
      {
        command: 'workbench.action.retractBottomPanel',
        group: 'navigation',
        when: 'bottomFullExpanded',
        order: 1,
      },
      {
        command: 'workbench.action.toggleBottomPanel',
        group: 'navigation',
        order: 2,
      },
    ]);

    // 创建通用标题菜单
    const commonTitleMenu = ctxMenuService.createMenu({
      id: 'tabbar/bottom/common',
    });

    return commonTitleMenu;
  }

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

  doExpand(expand: boolean, resizeHandle?: ITabbarResizeOptions): void {
    if (!resizeHandle) {
      return;
    }

    const { setRelativeSize } = resizeHandle;
    if (expand) {
      // 底部面板展开：底部占满，上部为0
      setRelativeSize(0, 1);
    } else {
      // FIXME 底部需要额外的字段记录展开前的尺寸
      setRelativeSize(2, 1);
    }
  }

  isExpanded(resizeHandle?: ITabbarResizeOptions): boolean {
    if (!resizeHandle) {
      return false;
    }

    const { getRelativeSize } = resizeHandle;
    const relativeSizes = getRelativeSize().join(',');
    // 底部面板展开时的比例是 '0,1'
    return relativeSizes === '0,1';
  }

  handleActivateKeyBinding(
    containerId: string,
    currentContainerId: string,
    updateCurrentContainerId: (id: string) => void,
    forceShow?: boolean,
  ): void {
    // 底部面板支持 toggle 行为
    if (!forceShow) {
      updateCurrentContainerId(currentContainerId === containerId ? '' : containerId);
    } else {
      updateCurrentContainerId(containerId);
    }
  }

  handleFullExpanded(
    currentId: string,
    isCurrentExpanded: boolean,
    resizeHandle: ITabbarResizeOptions,
    options: { barSize: number; panelSize: number; prevSize?: number },
  ): void {
    const { barSize, panelSize, prevSize } = options;
    const { setRelativeSize, setSize } = resizeHandle;

    if (currentId) {
      if (isCurrentExpanded) {
        // 底部面板全展开
        setRelativeSize(0, 1);
      } else {
        setSize(prevSize || panelSize + barSize);
      }
    } else {
      setSize(barSize);
    }
  }

  tryRestoreAccordionSize(): void {
    // 不支持手风琴
  }
}
