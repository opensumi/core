import { Command } from '@opensumi/ide-core-common';

export namespace QUICK_OPEN_COMMANDS {
  export const OPEN: Command = {
    id: 'editor.action.quickCommand',
  };
  export const OPEN_OUTLINE: Command = {
    id: 'editor.action.quickOutline',
  };
}

export * from '@opensumi/ide-core-browser/lib/quick-open';
// eslint-disable-next-line import/no-restricted-paths
export * from '../browser/quick-open-action-provider';
