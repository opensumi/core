import { LogLevel } from '@opensumi/ide-core-common';
import { IBuiltInCommand, extProcessInit } from '@opensumi/ide-extension/lib/hosted/ext.process-base';

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
