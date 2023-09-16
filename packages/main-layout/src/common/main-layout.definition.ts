import { BasicEvent, IDisposable, SlotLocation } from '@opensumi/ide-core-browser';
import { ViewContainerOptions, View, SideStateManager } from '@opensumi/ide-core-browser/lib/layout';
import { ComponentRegistryInfo } from '@opensumi/ide-core-browser/lib/layout/layout.interface';
import { IContextMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { Deferred, Event } from '@opensumi/ide-core-common';
import { IContextKeyExpression } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

// eslint-disable-next-line import/no-restricted-paths
import type { AccordionService } from '../browser/accordion/accordion.service';
// eslint-disable-next-line import/no-restricted-paths
import type { TabbarService } from '../browser/tabbar/tabbar.service';
// eslint-disable-next-line import/no-restricted-paths
import type { TabBarHandler } from '../browser/tabbar-handler';

export interface ComponentCollection {
  views?: View[];
  options: ViewContainerOptions;
}

export interface ViewComponentOptions {
  isReplace?: boolean;
  fromExtension?: boolean;
}

export const IMainLayoutService = Symbol('IMainLayoutService');
export interface IMainLayoutService {
  viewReady: Deferred<void>;

  didMount(): void;
  // 切换tabbar位置的slot，支持left、right、bottom
  toggleSlot(location: SlotLocation, show?: boolean, size?: number): void;
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
   * 获指定 containerId 的注册实例
   * @param containerId container id
   */
  getContainer(containerId: string): ComponentRegistryInfo | undefined;
  /**
   * 向侧边栏container内附加新的子视图
   * @param view 子视图信息
   * @param containerId 子视图需要附加的容器id
   * @param props 初始prop
   */
  collectViewComponent(view: View, containerId: string, props?: any, options?: ViewComponentOptions): string;
  /**
   * 替换一个已注册的视图
   * @param view 子视图信息
   * @param props 初始prop
   */
  replaceViewComponent(view: View, props?: any): void;
  /**
   * 从手风琴销毁一个子视图
   * @param viewId 子视图ID
   */
  disposeViewComponent(viewId: string): void;
  /**
   * 销毁一个容器视图
   * @param containerId 容器视图ID
   */
  disposeContainer(containerId: string): void;
  expandBottom(expand: boolean): void;
  bottomExpanded: boolean;
  // @deprecated 提供小程序使用的额外位置控制
  setFloatSize(size: number): void;
  // force reveal a view ignoring its when clause
  revealView(viewId: string): void;
  getTabbarService(location: string): TabbarService;
  getAccordionService(containerId: string, noRestore?: boolean): AccordionService;
  getViewAccordionService(viewId: string): AccordionService | undefined;
  // 某一位置是否可见
  isVisible(location: string): boolean;
  isViewVisible(viewId: string): boolean;
  getExtraTopMenu(): IContextMenu;
  getExtraMenu(): IContextMenu;
  getAllAccordionService(): Map<string, AccordionService>;
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
export class TabBarRegistrationEvent extends BasicEvent<{ tabBarId: string }> {}

export const IViewsRegistry = Symbol('IViewsRegistry');

export interface IViewsRegistry {
  readonly onDidChangeViewWelcomeContent: Event<string>;
  registerViewWelcomeContent(id: string, descriptor: IViewContentDescriptor): IDisposable;
  registerViewWelcomeContent2<TKey>(
    id: string,
    viewContentMap: Map<TKey, IViewContentDescriptor>,
  ): Map<TKey, IDisposable>;
  getViewWelcomeContent(id: string): IViewContentDescriptor[];
}

export interface IViewContentDescriptor {
  readonly content: string;
  readonly when?: IContextKeyExpression | 'default';
  readonly group?: string;
  readonly order?: number;
  readonly precondition?: IContextKeyExpression | undefined;
}

export class ViewCollapseChangedEvent extends BasicEvent<{
  viewId: string;
  collapsed: boolean;
}> {}

export const SUPPORT_ACCORDION_LOCATION = new Set([SlotLocation.left, SlotLocation.right]);
