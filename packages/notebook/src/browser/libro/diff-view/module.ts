import { LibroJupyterNoEditorModule } from '@difizen/libro-jupyter/noeditor';
import { ManaModule } from '@difizen/mana-core';
import { LibroDiffColorRegistry } from './libro-diff-color-registry';
import { AIStudioLibroVersionView } from './libro-version-view';
import { LibroDiffView } from './libro-diff-view';
import { LibroVersionManager } from './libro-version-manager';

export const LibroDiffModule = ManaModule.create()
  .register(AIStudioLibroVersionView, LibroVersionManager, LibroDiffView, LibroDiffColorRegistry)
  .dependOn(LibroJupyterNoEditorModule);
