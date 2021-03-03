import { Provider, Injectable, Autowired } from '@ali/common-di';
import type { IBulkEditOptions } from '@ali/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import type { WorkspaceEdit } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { ComponentRegistry, BrowserModule, ComponentContribution, Domain, MonacoContribution, MonacoService, ServiceNames, ILogger } from '@ali/ide-core-browser';
import { IWorkspaceEditService, IWorkspaceFileService } from '../common';
import { WorkspaceEditServiceImpl } from './workspace-edit.service';
import { MonacoBulkEditService } from './bulk-edit.service';
import { WorkspaceFileService } from './workspace-file.service';
import { RefactorPreview, RefactorPreviewTitle } from './refactor-preview';
import { IRefactorPreviewService, RefactorPreviewServiceImpl } from './refactor-preview.service';

@Injectable()
export class WorkspaceEditModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IWorkspaceEditService,
      useClass: WorkspaceEditServiceImpl,
    },
    {
      token: IWorkspaceFileService,
      useClass: WorkspaceFileService,
    },
    {
      token: IRefactorPreviewService,
      useClass: RefactorPreviewServiceImpl,
    },
    WorkspaceEditContribution,
  ];
}

@Domain(MonacoContribution, ComponentContribution)
export class WorkspaceEditContribution implements MonacoContribution, ComponentContribution {
  @Autowired(MonacoService)
  private monacoService: MonacoService;

  @Autowired()
  protected readonly bulkEditService: MonacoBulkEditService;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(IRefactorPreviewService)
  protected readonly refactorPreviewService: IRefactorPreviewService;

  private async previewEdit(edit: WorkspaceEdit, options?: IBulkEditOptions): Promise<WorkspaceEdit> {
    try {
      const edits = await this.refactorPreviewService.previewEdits(edit);
      return { edits };
    } catch (err) {
      this.logger.error(`Preview textEdit error: \n ${err.message}`);
      return { edits: [] };
    }
  }

  onMonacoLoaded() {
    this.monacoService.registerOverride(ServiceNames.BULK_EDIT_SERVICE, this.bulkEditService);
    this.bulkEditService.setPreviewHandler(this.previewEdit.bind(this));
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register(
      '@ali/ide-refactor-preview',
      {
        id: 'ide-refactor-preview',
        component: RefactorPreview,
        hidden: true,
      },
      {
        title: 'REFACTOR PREVIEW',
        priority: 12,
        hidden: true,
        containerId: 'refactor-preview',
        // activateKeyBinding: 'ctrlcmd+shift+m',
        titleComponent: RefactorPreviewTitle,
      },
    );
  }
}
