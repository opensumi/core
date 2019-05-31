import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, SlotMap, CommandContribution } from '@ali/ide-core-browser';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider, servicePath as FileTreeServicePath } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { SlotLocation } from '@ali/ide-main-layout';
import FileTreeService from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';

import { SidePanelRegistry } from '@ali/ide-side-panel/lib/browser/side-panel-registry';

@Injectable()
export class FileTreeModule extends BrowserModule {

  providers: Provider[] = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
    FileTreeContribution,
  ];

  frontServices = [{
    servicePath: FileTreeServicePath,
    token: FileTreeService,
  }];

  slotMap: SlotMap = new Map([
    [SlotLocation.leftPanel, FileTree],
  ]);

  @Autowired()
  sidePanelRegistry: SidePanelRegistry;

  active() {
    // this.sidePanelRegistry.registerComponent(FileTree, {
    //   name: 'filetree',
    //   iconClass: 'eye',
    //   description: 'description filetree',
    // });
  }
}
