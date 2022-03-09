Object.defineProperty(exports, '__esModule', { value: true });
const ide_core_common_1 = require('../../../packages/core-common');
const ext_process_base_1 = require('../../../packages/extension/lib/hosted/ext.process-base');

const builtinCommands = [
  {
    id: 'test:builtinCommand:test',
    handler: (args) => 'fake token',
  },
];
ext_process_base_1.extProcessInit({
  builtinCommands,
  logLevel: ide_core_common_1.LogLevel.Info,
});
