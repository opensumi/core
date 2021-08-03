import { extProcessInit } from '@ali/ide-kaitian-extension/lib/hosted/ext.process-base.js';
import LogServiceClass from './mock-log-service';

(async () => {
  await extProcessInit({ LogServiceClass, builtinCommands: [] });
})();
