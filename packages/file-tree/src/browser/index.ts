import * as React from 'react';
import { Provider, Injector } from '@ali/common-di';
import { servicePath as FileTreeServicePath, IFileTreeAPI } from '../common';
import { FileTreeAPI } from './file-tree.api';
import { FileTreeService } from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';
import { FileTree } from './file-tree.view';
import { BrowserModule, EffectDomain, ModuleDependencies } from '@ali/ide-core-browser';
import { WorkspaceModule } from '@ali/ide-workspace/lib/browser';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

const pkgJson = require('../../package.json');

@EffectDomain(pkgJson.name)
@ModuleDependencies([WorkspaceModule])
export class FileTreeModule extends BrowserModule {

  providers: Provider[] = [
    {
      token: IFileTreeAPI,
      useClass: FileTreeAPI,
    },
    FileTreeContribution,
  ];

  frontServices = [{
    servicePath: FileTreeServicePath,
    token: FileTreeService,
  }];

  component = FileTree;
  iconClass = getIcon('explorer');
}
