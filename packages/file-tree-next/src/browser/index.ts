import { Provider } from '@ali/common-di';
import { IFileTreeAPI } from '../common';
import { FileTreeAPI } from './services/file-tree-api.service';
import { FileTreeService } from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';
import { BrowserModule, EffectDomain, ModuleDependencies } from '@ali/ide-core-browser';
import { WorkspaceModule } from '@ali/ide-workspace/lib/browser';

const pkgJson = require('../../package.json');

@EffectDomain(pkgJson.name)
@ModuleDependencies([WorkspaceModule])
export class FileTreeNextModule extends BrowserModule {

  providers: Provider[] = [
    {
      token: IFileTreeAPI,
      useClass: FileTreeAPI,
    },
    {
      token: FileTreeService,
      useClass: FileTreeService,
    },
    FileTreeContribution,
  ];
}
