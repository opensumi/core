import { observable, action } from 'mobx';
import React from 'react';

import { Injector, Injectable, Autowired, INJECTOR_TOKEN } from '@opensumi/di';
import { Deferred, localize, MessageType } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IDialogService } from '@opensumi/ide-overlay';
import { ResourceEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import type { WorkspaceFileEdit, WorkspaceTextEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';

import { RefactorPreview } from './refactor-preview';

export const PreviewViewId = 'RefactorPreview';

export interface IRefactorPreviewService {
  edits: Array<WorkspaceTextEdit | WorkspaceFileEdit>;
  selectedFileOrTextEdits: Set<WorkspaceTextEdit | WorkspaceFileEdit>;

  previewEdits(edit: ResourceEdit[]): Promise<ResourceEdit[]>;

  filterEdit(edit: WorkspaceTextEdit | WorkspaceFileEdit, checked: boolean): void;

  applyEdits(): void;

  clearAllEdits(): void;
}

export const IRefactorPreviewService = Symbol('IRefactorPreviewService');

@Injectable()
export class RefactorPreviewServiceImpl implements IRefactorPreviewService {
  @observable.shallow
  public edits: Array<WorkspaceTextEdit | WorkspaceFileEdit> = [];

  public selectedFileOrTextEdits = observable.set<WorkspaceTextEdit | WorkspaceFileEdit>([], { deep: false });

  @Autowired(IMainLayoutService)
  protected readonly mainLayout: IMainLayoutService;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  private previewDeferred: Deferred<Array<WorkspaceTextEdit | WorkspaceFileEdit>> | null;

  private clear() {
    this.togglePreviewView(false);
    this.edits = [];
    this.previewDeferred = null;
    this.selectedFileOrTextEdits.clear();
  }

  private registerRefactorPreviewView() {
    const handler = this.mainLayout.getTabbarHandler(PreviewViewId);
    if (handler) {
      return;
    }

    this.mainLayout.collectTabbarComponent(
      [
        {
          component: RefactorPreview,
          id: PreviewViewId,
        },
      ],
      {
        title: localize('refactor-preview.title', 'REFACTOR PREVIEW'),
        containerId: PreviewViewId,
        hidden: true,
      },
      'bottom',
    );
  }

  private togglePreviewView(show: boolean) {
    const handler = this.mainLayout.getTabbarHandler(PreviewViewId);
    if (show) {
      handler?.show();
      handler?.activate();
    } else {
      handler?.hide();
      handler?.deactivate();
    }
  }

  async previewEdits(edits: ResourceEdit[]): Promise<ResourceEdit[]> {
    this.registerRefactorPreviewView();

    if (this.previewDeferred) {
      const continued = await this.dialogService.open(
        <div>
          {localize('refactor-preview.overlay.title')}
          <p>{localize('refactor-preview.overlay.detail')}</p>
        </div>,
        MessageType.Warning,
        [localize('refactor-preview.overlay.cancel'), localize('refactor-preview.overlay.continue')],
      );

      if (continued === localize('refactor-preview.overlay.cancel')) {
        return [];
      }
    }

    this.togglePreviewView(true);

    this.edits = edits;
    // 默认全选
    edits.forEach((edit) => {
      this.selectedFileOrTextEdits.add(edit);
    });

    this.previewDeferred = new Deferred();

    return this.previewDeferred.promise;
  }

  @action
  filterEdit(edit: WorkspaceTextEdit | WorkspaceFileEdit, checked: boolean) {
    if (checked) {
      this.selectedFileOrTextEdits.add(edit);
    } else {
      this.selectedFileOrTextEdits.delete(edit);
    }
  }

  applyEdits(): void {
    if (!this.previewDeferred) {
      // it's can not be happened
      return;
    }

    const candidate = this.edits.filter((edit: WorkspaceTextEdit) => this.selectedFileOrTextEdits.has(edit));

    this.previewDeferred.resolve(candidate);
    this.clear();
  }

  clearAllEdits(): void {
    if (!this.previewDeferred) {
      return;
    }

    this.previewDeferred.resolve([]);
    this.clear();
  }
}
