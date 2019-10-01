import * as React from 'react';
import { Provider, Injector, ConstructorOf } from '@ali/common-di';
import { createFileTreeAPIProvider, servicePath as FileTreeServicePath } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { FileTreeService } from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';
import { FileTree } from './file-tree.view';
import { BrowserModule, EffectDomain, ModuleDependencies } from '@ali/ide-core-browser';
import { FileTreeItemKeybindingContext } from './file-tree-keybinding-contexts';
import { WorkspaceModule } from '@ali/ide-workspace/lib/browser';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

const pkgJson = require('../../package.json');

const bindFileTreePreference = (injector: Injector) => {
  // console.log(injector);
};

@EffectDomain(pkgJson.name)
@ModuleDependencies([WorkspaceModule])
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

  preferences = bindFileTreePreference;

  component = FileTree;
  iconClass = getIcon('explorer');
}

export * from './file-tree.service';
export * from './file-tree.view';
export * from './file-tree-contribution';
export * from './file-tree-keybinding-contexts';
