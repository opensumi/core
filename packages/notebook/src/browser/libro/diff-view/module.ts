import { LibroJupyterModule } from '@alipay/libro-jupyter';
import { ManaModule } from '@alipay/mana-core';
import { LibroDiffColorRegistry } from './libro-diff-color-registry';
import { LibroDiffView } from './libro-diff-view';

export const LibroDiffModule = ManaModule.create()
  .register(LibroDiffView, LibroDiffColorRegistry)
  .dependOn(LibroJupyterModule);
