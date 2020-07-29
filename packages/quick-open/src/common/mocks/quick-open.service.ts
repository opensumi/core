import { QuickOpenOptions, HideReason, QuickOpenService, QuickOpenModel } from '../';
import { MessageType } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';

@Injectable()
export class MockQuickOpenService implements QuickOpenService {
  refresh(): void {
    throw new Error('Method not implemented.');
  }
  widgetNode: HTMLElement;

  open(model: QuickOpenModel, options?: QuickOpenOptions): void {
    throw new Error('Method not implemented.');
  }
  hide(reason?: HideReason): void {
    throw new Error('Method not implemented.');
  }
  showDecoration(type: MessageType): void {
    throw new Error('Method not implemented.');
  }
  hideDecoration(): void {
    throw new Error('Method not implemented.');
  }
}
