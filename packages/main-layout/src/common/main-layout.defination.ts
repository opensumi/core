import { Injectable, Provider } from '@ali/common-di';
import { ConstructorOf } from '@ali/ide-core-common';
import { SlotLocation } from './main-layout-slot';
import { BasicEvent } from '@ali/ide-core-browser';

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
  toggleSlot(location: SlotLocation, show?: boolean): void;
  isVisible(location: SlotLocation): boolean;
  registerTabbarComponent(component: React.FunctionComponent, extra: string, side: string, isSingleMod: boolean): void;
}
