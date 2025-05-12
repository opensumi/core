import { ManaModule } from '@difizen/libro-common/app';
import { LibroJupyterNoEditorModule } from '@difizen/libro-jupyter/noeditor';

import { LibroDiffColorRegistry } from './libro-diff-color-registry';
import { LibroDiffView } from './libro-diff-view';
import { LibroVersionManager } from './libro-version-manager';
import { AIStudioLibroVersionView } from './libro-version-view';

export const LibroDiffModule = ManaModule.create()
  .register(AIStudioLibroVersionView, LibroVersionManager, LibroDiffView, LibroDiffColorRegistry)
  .dependOn(LibroJupyterNoEditorModule);
