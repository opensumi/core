import * as React from 'react';
import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { createFileTreeAPIProvider, servicePath as FileTreeServicePath } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import FileTreeService from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';
import { FileTree } from './file-tree.view';
import { FileTreeItemKeybindingContext } from './file-tree-keybinding-contexts';

@Injectable()
export class FileTreeModule extends BrowserModule {

  providers: Provider[] = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
    FileTreeItemKeybindingContext,
    FileTreeContribution,
  ];

  frontServices = [{
    servicePath: FileTreeServicePath,
    token: FileTreeService,
  }];

  component = FileTree;
  iconClass = 'volans_icon code_editor';
}
