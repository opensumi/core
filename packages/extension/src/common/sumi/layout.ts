
import { Event } from '@ide-framework/ide-core-common';

export interface ITabbarHandler {

  setSize(size: number): void;

  setTitle(title: string): void;

  setIcon(iconPath: string): void;

  setBadge(badge: string): void;

  activate(): void;

  deactivate(): void;

  onActivate: Event<void>;

  isAttached(): Promise<boolean>;

}

export interface IMainThreadLayout {
  $connectTabbar(id: string): Promise<void>;
  $setSize(id: string, size: number): void;
  $setTitle(id: string, title: string): void;
  $setIcon(id: string, iconPath: string): void;
  $setBadge(id: string, badge: string): void;
  $activate(id: string): void;
  $deactivate(id: string): void;
  $setVisible(id: string, visible: boolean): Promise<void>;
  $isAttached(id: string): Promise<boolean>;
}

export interface IExtHostLayout {
  getTabbarHandler(id: string): ITabbarHandler;
  $acceptMessage(id: string, type: 'activate' | 'deactivate'): void;
}
