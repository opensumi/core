import { Provider } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';

export class FileTreeModule extends BrowserModule {
  providers: Provider[] = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];

  slotMap: SlotMap = new Map([
    [SlotLocation.leftPanel, FileTree],
  ]);
}
