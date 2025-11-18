import { Provider } from '@opensumi/di';

import { LibroStateManager } from './libro-state-manager';

export const LibroStateModule: Provider[] = [
  {
    token: LibroStateManager,
    useClass: LibroStateManager,
  },
];
