import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { FileTreeContribution } from './file-tree-contribution';

export class FileTreeModule extends BrowserModule {
  providers = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];

  slotMap = new Map([
    [SlotLocation.leftPanel, FileTree],
  ]);

  // 当前需要依赖的 Contribution
  contributionsCls = [
    FileTreeContribution
  ]
}
