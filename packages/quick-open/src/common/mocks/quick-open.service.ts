import { QuickOpenOptions, HideReason, QuickOpenService, QuickOpenModel } from '../../../lib';
import { MessageType } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';

@Injectable()
export class MockQuickOpenService implements QuickOpenService {

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
