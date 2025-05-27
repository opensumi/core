import { ComponentRegistryProvider, DisposableCollection } from '@opensumi/ide-core-browser';
import { SCM_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import { ResizeHandle } from '@opensumi/ide-core-browser/lib/components';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';

import { BaseTabbarStrategy, ITabbarResizeOptions } from './base-tabbar.strategy';

/**
 * 侧边 tabbar 策略（适用于 view 和 extendView 位置）
 */
export class SideTabbarStrategy extends BaseTabbarStrategy {
  private isLatter: boolean;

  private accordionRestored: Set<string> = new Set();

  constructor(location: string) {
    super(location);
    // TODO: 该值与插槽渲染器的实现相关
    // panel 和 bar 的相对位置，isLatter 表示 bar 在 panel 右侧或底下
    this.isLatter = location === 'extendView';
  }

  registerLocationSpecificCommands(): DisposableCollection {
    // 侧边 tabbar 没有特殊命令
    return new DisposableCollection();
  }

  registerLocationSpecificMenus(): undefined {
    // 侧边 tabbar 没有特殊菜单
    return;
  }

  wrapResizeHandle(resizeHandle: ResizeHandle): ITabbarResizeOptions {
    const { setSize, setRelativeSize, getSize, getRelativeSize, lockSize, setMaxSize, hidePanel } = resizeHandle;

    return {
      setSize: (size) => setSize(size, this.isLatter),
      setRelativeSize: (prev: number, next: number) => setRelativeSize(prev, next, this.isLatter),
      getSize: () => getSize(this.isLatter),
      getRelativeSize: () => getRelativeSize(this.isLatter),
      setMaxSize: (lock: boolean | undefined) => setMaxSize(lock, this.isLatter),
      lockSize: (lock: boolean | undefined) => lockSize(lock, this.isLatter),
      hidePanel: (show) => hidePanel(show),
    };
  }

  doExpand(): void {
    throw new Error('Not implemented');
  }

  isExpanded(): boolean {
    return false;
  }

  handleActivateKeyBinding(
    containerId: string,
    _currentContainerId: string,
    updateCurrentContainerId: (id: string) => void,
  ): void {
    // 侧边 tabbar 总是直接激活，不支持 toggle
    updateCurrentContainerId(containerId);
  }

  handleFullExpanded(): void {
    throw new Error('Not implemented');
  }

  tryRestoreAccordionSize(containerInfo: ComponentRegistryProvider, layoutService: IMainLayoutService): void {
    const { containerId } = containerInfo.options || {};
    if (!containerId || this.accordionRestored.has(containerId)) {
      return;
    }
    // 使用自定义视图取代手风琴的面板不需要 restore
    // scm 视图例外，因为在新版本 Gitlens 中可以将自己注册到 scm 中
    // 暂时用这种方式使 scm 面板状态可以被持久化
    if (
      (!containerInfo || containerInfo.options?.component) &&
      containerInfo?.options?.containerId !== SCM_CONTAINER_ID
    ) {
      return;
    }
    const accordionService = layoutService.getAccordionService(containerId);
    // 需要保证此时tab切换已完成dom渲染
    accordionService.restoreState();
    this.accordionRestored.add(containerId);
  }
}
