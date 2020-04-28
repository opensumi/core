import { extProcessInit, IBuiltInCommand } from '@ali/ide-kaitian-extension/lib/hosted/ext.process-base';
import { LogLevel } from '@ali/ide-core-common';

const builtinCommands: IBuiltInCommand[] = [
  {
    id: 'test:builtinCommand:test',
    handler: {
      handler: (args) => {
        return 'fake token';
      },
    },
  },
];

extProcessInit({
  builtinCommands,
  logLevel: LogLevel.Info,
});
