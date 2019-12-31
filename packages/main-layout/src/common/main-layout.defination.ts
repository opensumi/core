import { BasicEvent, SlotLocation, Event } from '@ali/ide-core-browser';
import { ViewContainerOptions, View, SideStateManager } from '@ali/ide-core-browser/lib/layout';
import { TabBarHandler } from '../browser/tabbar-handler';
import { TabbarService } from '../browser/tabbar/tabbar.service';
import { AccordionService } from '../browser/accordion/accordion.service';
import { IContextMenu } from '@ali/ide-core-browser/lib/menu/next';

export interface ComponentCollection {
  views?: View[];
  options: ViewContainerOptions;
}

export const IMainLayoutService = Symbol('IMainLayoutService');
export interface IMainLayoutService {
  // 切换tabbar位置的slot，支持left、right、bottom，size能力暂未实现
  toggleSlot(location: SlotLocation, show?: boolean, size?: number): void;
  restoreState(): void;
  /**
   * 获取注册到tabbar位置视图的handler，封装了常用的layout操作
   * 请在onRendered事件触发后或onDidRender contribution内获取handle，否则获取到为空
   * @param handlerId container或view id
   */
  getTabbarHandler(handlerId: string): TabBarHandler | undefined;
  /**
   * 注册单个或多个视图到tabbar位置
   * @param views 使用手风琴能力时传入的多个子视图
   * @param options container相关选项
   * @param side 注册的位置，支持left、right、bottom
   */
  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string): string;
  /**
   * 向侧边栏container内附加新的子视图
   * @param view 子视图信息
   * @param containerId 子视图需要附加的容器id
   * @param props 初始prop
   */
  collectViewComponent(view: View, containerId: string, props?: any): string;
  /**
   * 替换一个已注册的视图
   * @param view 子视图信息
   * @param props 初始prop
   */
  replaceViewComponent(view: View, props?: any): void;
  disposeViewComponent(viewId: string): void;
  expandBottom(expand: boolean): void;
  bottomExpanded: boolean;
  // @deprecated 提供小程序使用的额外位置控制
  setFloatSize(size: number): void;
  handleSetting(anchor: {x: number; y: number}): void;
  getTabbarService(location: string, noAccordion?: boolean): TabbarService;
  getAccordionService(containerId: string): AccordionService;
  // 某一位置是否可见
  isVisible(location: string): boolean;
  getExtraMenu(): IContextMenu;
}

export const MainLayoutContribution = Symbol('MainLayoutContribution');

export interface MainLayoutContribution {

  // 将LayoutConfig渲染到各Slot后调用
  onDidRender?(): void;

  provideDefaultState?(): SideStateManager;

}

/**
 * 当有新的TabBar被注册时发送的新事件
 */
export class TabBarRegistrationEvent extends BasicEvent<{tabBarId: string}> {}
