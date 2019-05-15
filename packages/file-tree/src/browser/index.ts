import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';

export class FileTreeModule extends BrowserModule {
  providers = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];

  slotMap = new Map([
    [SlotLocation.leftPanel, FileTree],
  ]);
}
