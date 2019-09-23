import { Provider, Injectable, Autowired } from '@ali/common-di';
import { BrowserModule, Domain, MonacoContribution, MonacoService, ServiceNames } from '@ali/ide-core-browser';
import { IWorkspaceEditService } from '../common';
import { WorkspaceEditServiceImpl } from './workspace-edit.service';
import { MonacoBulkEditService } from './bulk-edit.service';

@Injectable()
export class WorkspaceEditModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IWorkspaceEditService,
      useClass: WorkspaceEditServiceImpl,
    },
    WorkspaceEditContribution,
  ];
}

@Domain(MonacoContribution)
export class WorkspaceEditContribution implements MonacoContribution {
  @Autowired(MonacoService)
  private monacoService: MonacoService;

  @Autowired()
  bulkEditService: MonacoBulkEditService;

  onMonacoLoaded() {
    this.monacoService.registerOverride(ServiceNames.BULK_EDIT_SERVICE, this.bulkEditService);
  }
}
