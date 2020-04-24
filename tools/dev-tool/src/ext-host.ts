import { extProcessInit, IBuiltinCommand } from '@ali/ide-kaitian-extension/lib/hosted/ext.process-base';
import { LogLevel } from '@ali/ide-core-common';

const builtinCommands: IBuiltinCommand[] = [
  {
    id: 'test:builtinCommand:test',
    handler: (args) => {
      return 'fake token';
    },
  },
];

extProcessInit({
  builtinCommands,
  logLevel: LogLevel.Info,
});
