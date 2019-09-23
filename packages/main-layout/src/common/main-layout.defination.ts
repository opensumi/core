import { BasicEvent, SlotLocation } from '@ali/ide-core-browser';
import { ActivityBarHandler } from '@ali/ide-activity-bar/lib/browser/activity-bar-handler';
import { ViewContainerOptions, View } from '@ali/ide-core-browser/lib/layout';

export class InitedEvent extends BasicEvent<void> {}

export interface ComponentCollection {
  views?: View[];
  options: ViewContainerOptions;
}
export interface ViewToContainerMapData {
  [key: string ]: string | number;
}

export const IMainLayoutService = Symbol('IMainLayoutService');
export interface IMainLayoutService {
  tabbarComponents: ComponentCollection[];
  toggleSlot(location: SlotLocation, show?: boolean, size?: number): void;
  isVisible(location: SlotLocation): boolean;
  restoreState(): void;
  getTabbarHandler(handlerId: string): ActivityBarHandler;
  registerTabbarViewToContainerMap(map: ViewToContainerMapData): void;
  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string): string;
  collectViewComponent(view: View, containerId: string, props?: any);
  expandBottom(expand?: boolean): void;
  bottomExpanded: boolean;
}

export const MainLayoutContribution = Symbol('MainLayoutContribution');

export interface MainLayoutContribution {

  // 将LayoutConfig渲染到各Slot后调用
  onDidUseConfig?(): void;

}
