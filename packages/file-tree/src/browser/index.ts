import { RenderNameEnum, BrowserModule } from '@ali/ide-core-browser';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';

export const fileTree: BrowserModule = {
  providers: [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ],
  slotMap: new Map([
    [RenderNameEnum.main, FileTree],
  ]),
};
