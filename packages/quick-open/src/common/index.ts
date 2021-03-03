import { Command } from '@ali/ide-core-common';

export namespace QUICK_OPEN_COMMANDS {
  export const OPEN: Command = {
    id: 'editor.action.quickCommand',
  };
}

export * from '../browser/quick-open.model';
export * from '../browser/quick-open-action-provider';
