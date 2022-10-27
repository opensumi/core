import { isMacintosh, isWindows } from '@opensumi/ide-utils';

export const keypressWithCmdCtrl = (key: string) => {
  const modifier = isMacintosh ? 'Meta' : isWindows ? 'Ctrl' : 'Control';
  return `${modifier}+${key}`;
};
