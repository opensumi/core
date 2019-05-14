import * as React from 'react';
import { RenderNameEnum, BrowserModule } from '@ali/ide-core-browser';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';

export class FileTreeModule extends BrowserModule {
  providers = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];

  slotMap = new Map([
    [RenderNameEnum.leftPanel, FileTree],
  ]);
}
