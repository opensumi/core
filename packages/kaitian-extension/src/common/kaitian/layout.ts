
import { Event } from '@ali/ide-core-common';

export interface ITabbarHandler {

  setSize(size: number): void;

  activate(): void;

  deactivate(): void;

  onActivate: Event<void>;

}

export interface IMainThreadLayout {
  $connectTabbar(id: string): Promise<void>;
  $setSize(id: string, size: number): void;
  $activate(id: string): void;
  $deactivate(id: string): void;
  $setVisible(id: string, visible: boolean): Promise<void>;
}

export interface IExtHostLayout {
  getTabbarHandler(id: string): ITabbarHandler;
  $acceptMessage(id: string, type: 'activate' | 'deactivate'): void;
}
