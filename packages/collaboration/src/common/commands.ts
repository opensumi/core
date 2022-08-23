import { Command } from '@opensumi/ide-core-common';

const category = 'Collaboration';

export const UNDO: Command = {
  id: 'collaboration.undo',
  label: 'collaboration.undo', // TODO i18n
  category,
};

export const REDO: Command = {
  id: 'collaboration.redo',
  label: 'collaboration.redo', // TODO i18n
  category,
};

export const Y_REMOTE_SELECTION = 'yRemoteSelection';
export const Y_REMOTE_SELECTION_HEAD = 'yRemoteSelectionHead';
