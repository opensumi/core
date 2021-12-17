import { extProcessInit, IBuiltInCommand } from '@opensumi/ide-extension/lib/hosted/ext.process-base';
import { LogLevel } from '@opensumi/ide-core-common';

const builtinCommands: IBuiltInCommand[] = [
  {
    id: 'test:builtinCommand:test',
    handler: {
      handler: (args) => 'fake token',
    },
  },
];

extProcessInit({
  builtinCommands,
  logLevel: LogLevel.Info,
});
