import * as React from 'react';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { SidePanelOpen } from '@ali/ide-side-panel/lib/side-panel.open';

export class FileTreeModule extends BrowserModule {
  providers = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];

  slotMap = new Map();
}
