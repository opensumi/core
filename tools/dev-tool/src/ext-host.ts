import { extProcessInit, IBuiltInCommand } from '@ide-framework/ide-extension/lib/hosted/ext.process-base';
import { LogLevel } from '@ide-framework/ide-core-common';

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
