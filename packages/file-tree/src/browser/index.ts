import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider, servicePath as FileTreeServicePath } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { SlotLocation } from '@ali/ide-main-layout';
import FileTreeService from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';

import {servicePath as FileServicePath} from '@ali/ide-file-service/lib/common';

import { SidePanelRegistry } from '@ali/ide-side-panel/lib/browser/side-panel-registry';

@Injectable()
export class FileTreeModule extends BrowserModule {

  providers: Provider[] = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];
  backServices = [{
    servicePath: FileServicePath,
  }];
  frontServices = [{
    servicePath: FileTreeServicePath,
    token: FileTreeService,
  }];

  slotMap = new Map();

  contributionsCls = [
    FileTreeContribution,
  ];

  @Autowired()
  sidePanelRegistry: SidePanelRegistry;

  active() {
    this.sidePanelRegistry.registerComponent(FileTree, {
      name: 'filetree',
      iconClass: 'fa-file',
      description: 'description filetree',
      side: 'right',
    });
  }
}
