import { Command } from '@opensumi/ide-core-common';

const COMMAND_CATEGORY = 'Collaboration';

export const UNDO: Command = {
  id: 'collaboration.undo',
  label: 'collaboration.undo', // TODO i18n
  category: COMMAND_CATEGORY,
};

export const REDO: Command = {
  id: 'collaboration.redo',
  label: 'collaboration.redo', // TODO i18n
  category: COMMAND_CATEGORY,
};
