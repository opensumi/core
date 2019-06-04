import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { createFileTreeAPIProvider, servicePath as FileTreeServicePath } from '../common';
import { FileTreeAPIImpl } from './file-tree.api';
import FileTreeService from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';

@Injectable()
export class FileTreeModule extends BrowserModule {

  providers: Provider[] = [
    createFileTreeAPIProvider(FileTreeAPIImpl),
    FileTreeContribution,
  ];

  frontServices = [{
    servicePath: FileTreeServicePath,
    token: FileTreeService,
  }];
}
