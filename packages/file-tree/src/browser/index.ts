import * as React from 'react';
import { Provider } from '@ali/common-di';
import { createFileTreeAPIProvider, servicePath as FileTreeServicePath } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { FileTreeService } from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';
import { FileTree } from './file-tree.view';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';
import { FileTreeItemKeybindingContext } from './file-tree-keybinding-contexts';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
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

export * from './file-tree.service';
export * from './file-tree.view';
export * from './file-tree-contribution';
export * from './file-tree-keybinding-contexts';
