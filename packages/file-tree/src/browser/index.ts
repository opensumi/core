import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { FileTreeContribution } from './file-tree-contribution';
import { SidePanelRegistry } from '@ali/ide-side-panel/lib/browser/side-panel-registry';

@Injectable()
export class FileTreeModule extends BrowserModule {
  @Autowired()
  private fileTreeContribution: FileTreeContribution;

  providers: Provider[] = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];

  @Autowired()
  sidePanelRegistry: SidePanelRegistry;

  active() {
    const app = this.app;
    app.commandRegistry.onStart([ this.fileTreeContribution ]);
    this.sidePanelRegistry.registerComponent(FileTree, {
      name: 'filetree',
      iconClass: 'eye',
      description: 'description filetree'
    });
  }
}
