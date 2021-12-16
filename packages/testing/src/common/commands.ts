import { Command, getIcon } from '@opensumi/ide-core-browser';

export const RuntTestCommand: Command = {
  id: 'testing-run-test',
  label: 'Run Test',
  iconClass: getIcon('start'),
};
