import { Command } from '@ali/ide-core-common';

export namespace QUICK_OPEN_COMMANDS {
  export const OPEN: Command = {
    id: 'editor.action.quickCommand',
  };
  export const OPEN_OUTLINE: Command = {
    id: 'editor.action.quickOutline',
  };
}

export * from '@ali/ide-core-browser/lib/quick-open';
export * from '../browser/quick-open-action-provider';
