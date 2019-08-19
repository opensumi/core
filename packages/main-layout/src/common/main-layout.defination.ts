import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf, URI, Emitter } from '@ali/ide-core-common';
import { SlotLocation } from './main-layout-slot';
import { BasicEvent } from '@ali/ide-core-browser';
import { ActivityBarHandler } from '@ali/ide-activity-bar/lib/browser/activity-bar-handler';
import { ViewContainerOptions, View } from '@ali/ide-core-browser/lib/layout';

@Injectable()
export abstract class MainLayoutAPI {
}

export function createMainLayoutAPIProvider<T extends MainLayoutAPI>(cls: ConstructorOf<T>): Provider {
  return {
    token: MainLayoutAPI as any,
    useClass: cls as any,
  };
}
export class PanelSize {
  constructor(public width: number, public height: number) {
  }
}

export class ResizePayload {
  constructor(public width: number, public height: number, public slotLocation: SlotLocation) {
  }
}
export class ResizeEvent extends BasicEvent<ResizePayload> {}

export class InitedEvent extends BasicEvent<void> {}

export class RenderedEvent extends BasicEvent<void> {}

export class VisibleChangedPayload {

  constructor(public isVisible: boolean, public slotLocation: SlotLocation) {}
}

export class VisibleChangedEvent extends BasicEvent<VisibleChangedPayload> {}

export interface ComponentCollection {
  views?: View[];
  options?: ViewContainerOptions;
  side?: string;
}
export interface ViewToContainerMapData {
  [key: string ]: string | number;
}

export const IMainLayoutService = Symbol('IMainLayoutService');
export interface IMainLayoutService {
  tabbarComponents: ComponentCollection[];
  toggleSlot(location: SlotLocation, show?: boolean, size?: number): void;
  isVisible(location: SlotLocation): boolean;
  getTabbarHandler(handlerId: string): ActivityBarHandler | undefined;
  registerTabbarViewToContainerMap(map: ViewToContainerMapData): void;
  registerTabbarComponent(views: View[], options: ViewContainerOptions, side: string): string | number | undefined;
  // onStart前需要调用这个方法注册
  collectTabbarComponent(views: View[], options: ViewContainerOptions, side: string): Promise<string | number>;
}

export const MainLayoutContribution = Symbol('MainLayoutContribution');

export interface MainLayoutContribution {

  // 将LayoutConfig渲染到各Slot后调用
  onDidUseConfig?(): void;

}
