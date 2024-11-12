import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { INotebookService } from '@opensumi/ide-editor';

import { KernelPanelContribution } from './kernel-panel/kernel.panel.contribution';
import { LibroKeybindContribition } from './libro-keybind-contribution';
import { LibroCommandContribution } from './libro.command';
import { LibroContribution } from './libro.contribution';
import { ILibroOpensumiService, LibroOpensumiService } from './libro.service';
import { NotebookServiceOverride } from './notebook.service';
import { TocContribution } from './toc/toc.contribution';

export * from './kernel-panel';
export * from './libro.color.tokens';
export * from './libro.contribution';
export * from './libro.protocol';
export * from './libro.service';
export * from './toc/index';

@Injectable()
export class NotebookModule extends BrowserModule {
  providers: Provider[] = [
    LibroContribution,
    LibroCommandContribution,
    TocContribution,
    {
      token: ILibroOpensumiService,
      useClass: LibroOpensumiService,
    },
    LibroKeybindContribition,
    {
      token: INotebookService,
      useClass: NotebookServiceOverride,
      override: true,
    },
    KernelPanelContribution,
  ];
}
