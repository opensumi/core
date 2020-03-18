import { Provider } from '@ali/common-di';
import { IFileTreeAPI } from '../common';
import { FileTreeAPI } from './services/file-tree-api.service';
import { FileTreeService } from './file-tree.service';
import { FileTreeContribution } from './file-tree-contribution';
import { BrowserModule, EffectDomain, ModuleDependencies } from '@ali/ide-core-browser';
import { WorkspaceModule } from '@ali/ide-workspace/lib/browser';
import { FileTreeDecorationService } from './services/file-tree-decoration.service';
import { FileTreeModelService } from './services/file-tree-model.service';

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
      token: FileTreeDecorationService,
      useClass: FileTreeDecorationService,
    },
    {
      token: FileTreeService,
      useClass: FileTreeService,
    },
    {
      token: FileTreeModelService,
      useClass: FileTreeModelService,
    },
    FileTreeContribution,
  ];
}
