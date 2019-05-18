import { Provider, Injectable, Autowired } from '@ali/common-di';
import { SlotMap } from '@ali/ide-core-browser';
import { BrowserModule } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { FileTree } from './file-tree.view';
import { createFileTreeAPIProvider } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import { FileTreeContribution } from './file-tree-contribution';
import {servicePath as FileServicePath} from '@ali/ide-file-service';

@Injectable()
export class FileTreeModule extends BrowserModule {

  providers: Provider[] = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
  ];
  backServices = [{
    servicePath: FileServicePath,
  }];

  slotMap: SlotMap = new Map([
    [SlotLocation.leftPanel, FileTree],
  ]);
  @Autowired()
  private fileTreeContribution: FileTreeContribution;

  active() {
    const app = this.app;
    app.commandRegistry.onStart([ this.fileTreeContribution ]);
  }
}
