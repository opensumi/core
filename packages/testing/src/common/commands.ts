import { getIcon } from '@opensumi/ide-core-browser/lib/style/icon/icon';
import { Command } from '@opensumi/ide-core-common/lib/command';

export const RuntTestCommand: Command = {
  id: 'testing-run-test',
  label: 'Run Test',
  iconClass: getIcon('start'),
};
