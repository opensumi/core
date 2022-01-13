import { Command, getExternalIcon, getIcon } from '@opensumi/ide-core-browser';

export const RuntTestCommand: Command = {
  id: 'testing.run.test',
  label: 'Run Test',
  iconClass: getIcon('start'),
};

export const GoToTestCommand: Command = {
  id: 'testing.goto.test',
  label: 'Go To Test',
  iconClass: getExternalIcon('go-to-file'),
};
