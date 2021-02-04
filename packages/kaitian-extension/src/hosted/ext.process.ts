import { extProcessInit } from './ext.process-base';
import { performance } from 'perf_hooks';
import { setPerformance } from './api/vscode/language/util';

setPerformance(performance);

(async () => {
  await extProcessInit();
})();
