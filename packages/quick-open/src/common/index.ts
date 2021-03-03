import { Command } from '@ali/ide-core-browser';

export class CommonCls {
  add(a: number, b: number) {
    return a + b;
  }
}

export const quickCommand: Command = {
  id: 'editor.action.quickCommand',
};

export * from '../browser/quick-open.model';
export * from '../browser/quick-open-action-provider';
