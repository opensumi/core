import { Provider } from '@opensumi/di';
import { BrowserModule, EffectDomain, ModuleDependencies } from '@opensumi/ide-core-browser';
import { IWindowDialogService } from '@opensumi/ide-overlay';
import { WorkspaceModule } from '@opensumi/ide-workspace/lib/browser';

import { IFileTreeAPI, IFileTreeService } from '../common';

import { WindowDialogServiceImpl } from './dialog/window-dialog.service';
import { FileTreeContribution } from './file-tree-contribution';
import { FileTreeService } from './file-tree.service';
import { FileTreeAPI } from './services/file-tree-api.service';
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
      token: IFileTreeService,
      useClass: FileTreeService,
    },
    {
      token: FileTreeModelService,
      useClass: FileTreeModelService,
    },
    {
      token: IWindowDialogService,
      useClass: WindowDialogServiceImpl,
    },
    FileTreeContribution,
  ];
}
