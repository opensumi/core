import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, SlotMap, useInjectable } from '@ali/ide-core-browser';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider, servicePath as FileTreeServicePath } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { SlotLocation } from '@ali/ide-main-layout';
import FileTreeService from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';

import { ActivatorBarService } from '@ali/ide-activator-bar/lib/browser/activator-bar.service';

@Injectable()
export class FileTreeModule extends BrowserModule {

  @Autowired()
  private activatorBarService!: ActivatorBarService;
  providers: Provider[] = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];

  frontServices = [{
    servicePath: FileTreeServicePath,
    token: FileTreeService,
  }];

  contributionsCls = [
    FileTreeContribution,
  ];

  active() {
    this.activatorBarService.append({iconClass: 'fa-file-code-o', component: FileTree});
  }
}
