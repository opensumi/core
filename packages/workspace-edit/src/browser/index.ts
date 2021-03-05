import { Provider, Injectable, Autowired } from '@ali/common-di';
import type { IBulkEditOptions } from '@ali/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import type { WorkspaceEdit } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';

import { BrowserModule, Domain, MonacoContribution, MonacoService, ServiceNames, ILogger, TabBarToolbarContribution, ToolbarRegistry, localize, CommandContribution, getIcon } from '@ali/ide-core-browser';
import { CommandRegistry } from '@ali/ide-core-common';

import { IWorkspaceEditService, IWorkspaceFileService } from '../common';
import { WorkspaceEditServiceImpl } from './workspace-edit.service';
import { MonacoBulkEditService } from './bulk-edit.service';
import { WorkspaceFileService } from './workspace-file.service';
import { IRefactorPreviewService, RefactorPreviewServiceImpl, PreviewViewId } from './refactor-preview.service';

const ClearEditsId = 'refactor-preview.clear.edits';
const ApplyEditsId = 'refactor-preview.apply.edits';

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

@Domain(MonacoContribution, TabBarToolbarContribution, CommandContribution)
export class WorkspaceEditContribution implements MonacoContribution, TabBarToolbarContribution, CommandContribution {
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
      if (!err) {
        // Canceled
      } else {
        this.logger.error(`Preview textEdit error: \n ${err.message}`);
      }
      return { edits: [] };
    }
  }

  onMonacoLoaded() {
    this.monacoService.registerOverride(ServiceNames.BULK_EDIT_SERVICE, this.bulkEditService);
    this.bulkEditService.setPreviewHandler(this.previewEdit.bind(this));
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: ClearEditsId,
      viewId: PreviewViewId,
      command: ClearEditsId,
      tooltip: localize('refactor-preview.title.clear'),
    });

    registry.registerItem({
      id: ApplyEditsId,
      viewId: PreviewViewId,
      command: ApplyEditsId,
      tooltip: localize('refactor-preview.title.apply'),
    });
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({
      id: ClearEditsId,
      iconClass: getIcon('clear'),
    }, {
      execute: () => {
        this.refactorPreviewService.clearAllEdits();
      },
    });

    registry.registerCommand({
      id: ApplyEditsId,
      iconClass: getIcon('check'),
    }, {
      execute: () => {
        this.refactorPreviewService.applyEdits();
      },
    });
  }

}
