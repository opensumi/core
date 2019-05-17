import { Provider } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { FileTreeContribution } from './file-tree-contribution';
import { Injectable, Autowired } from '@ali/common-di';
import { SidePanelRegistry } from '@ali/ide-side-panel/lib/browser/side-panel-registry';

@Injectable()
export class FileTreeModule extends BrowserModule {
  constructor() {
    super();
    this.sidePanelRegistry.registerComponent(FileTree, {
      name: '文件树',
      description: '文件树',
      iconClass: 'eye'
    });
  }

  providers: Provider[] = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];

  slotMap: SlotMap = new Map();

  @Autowired()
  sidePanelRegistry: SidePanelRegistry;

  // 当前需要依赖的 Contribution
  contributionsCls = [
    // FileTreeContribution
  ]
}
