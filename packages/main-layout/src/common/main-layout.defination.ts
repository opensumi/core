import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf, URI } from '@ali/ide-core-common';
import { SlotLocation } from './main-layout-slot';
import { BasicEvent } from '@ali/ide-core-browser';
import { ComponentInfo } from '@ali/ide-core-browser/lib/layout';
import { ActivityBarHandler } from '@ali/ide-activator-bar/lib/browser/activity-bar-handler';

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

export class VisibleChangedPayload {

  constructor(public isVisible: boolean, public slotLocation: SlotLocation) {}
}

export class VisibleChangedEvent extends BasicEvent<VisibleChangedPayload> {}

export const IMainLayoutService = Symbol('IMainLayoutService');
export interface IMainLayoutService {
  tabbarComponents: Array<{componentInfo: ComponentInfo, side: string}>;
  toggleSlot(location: SlotLocation, show?: boolean): void;
  isVisible(location: SlotLocation): boolean;
  registerTabbarComponent(componentInfo: ComponentInfo, side: string): ActivityBarHandler | undefined;
  // onStart前需要调用这个方法注册
  collectTabbarComponent(componentInfo: ExtComponentInfo, side: string): Promise<void>;
}

export interface ExtComponentInfo extends ComponentInfo {
  icon: URI;
}

export interface ExtraComponentInfo {
  title: string;
  iconClass: string;
}

export const MainLayoutContribution = Symbol('MainLayoutContribution');

export interface MainLayoutContribution {

  // Slot创建完毕时调用
  onDidCreateSlot?(): void;
  // 将LayoutConfig渲染到各Slot后调用
  onDidUseConfig?(): void;

}
