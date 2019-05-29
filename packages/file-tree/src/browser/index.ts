import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, SlotMap } from '@ali/ide-core-browser';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider, servicePath as FileTreeServicePath } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { SlotLocation } from '@ali/ide-main-layout';
import FileTreeService from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';

import {servicePath as FileServicePath} from '@ali/ide-file-service/lib/common';

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

  slotMap: SlotMap = new Map([
    [SlotLocation.leftPanel, FileTree],
  ]);

  contributionsCls = [
    FileTreeContribution,
  ];

  active() {
  }
}
