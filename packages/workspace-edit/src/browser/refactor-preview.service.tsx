import * as React from 'react';
import {
  Injector,
  Injectable,
  Autowired,
  INJECTOR_TOKEN,
} from '@ali/common-di';
import { observable, action } from 'mobx';

import { IMainLayoutService } from '@ali/ide-main-layout';
import type {
  WorkspaceEdit,
  WorkspaceFileEdit,
  WorkspaceTextEdit,
} from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { IDialogService } from '@ali/ide-overlay';
import { Deferred, localize, MessageType } from '@ali/ide-core-common';
import { RefactorPreview } from './refactor-preview';

export const PreviewViewId = 'RefactorPreview';

export interface IRefactorPreviewService {
  edits: Array<WorkspaceTextEdit | WorkspaceFileEdit>;
  selectedFileOrTextEdits: Set<WorkspaceTextEdit | WorkspaceFileEdit>;

  previewEdits(
    edit: WorkspaceEdit,
  ): Promise<Array<WorkspaceTextEdit | WorkspaceFileEdit>>;

  filterEdit(edit: WorkspaceTextEdit | WorkspaceFileEdit, checked: boolean): void;

  applyEdits(): void;

  clearAllEdits(): void;
}

export const IRefactorPreviewService = Symbol('IRefactorPreviewService');

@Injectable()
export class RefactorPreviewServiceImpl implements IRefactorPreviewService {

  @observable.shallow
  public edits: Array<WorkspaceTextEdit | WorkspaceFileEdit> = [];

  public selectedFileOrTextEdits = observable.set<WorkspaceTextEdit | WorkspaceFileEdit>(
    [],
    { deep: false },
  );

  @Autowired(IMainLayoutService)
  protected readonly mainLayout: IMainLayoutService;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;

  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  private previewDeferred: Deferred<
    Array<WorkspaceTextEdit | WorkspaceFileEdit>
  > | null;

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
      [{
        component: RefactorPreview,
        id: PreviewViewId,
      }],
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
    if (!!show) {
      handler?.show();
      handler?.activate();
    } else {
      handler?.hide();
      handler?.deactivate();
    }
  }

  async previewEdits(
    edit: WorkspaceEdit,
  ): Promise<Array<WorkspaceTextEdit | WorkspaceFileEdit>> {

    this.registerRefactorPreviewView();

    if (this.previewDeferred) {
      const continued = await this.dialogService.open(
        <div>
          {localize('refactor-preview.overlay.title')}
          <p>{localize('refactor-preview.overlay.detail')}</p>
        </div>,
        MessageType.Warning,
        [
          localize('refactor-preview.overlay.cancel'),
          localize('refactor-preview.overlay.continue'),
        ],
      );

      if (continued === localize('refactor-preview.overlay.cancel')) {
        return [];
      }
    }

    this.togglePreviewView(true);

    this.edits = edit.edits;
    // 默认全选
    edit.edits.forEach((edit) => {
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

    const candidate = this.edits.filter(
      (edit: WorkspaceTextEdit) => this.selectedFileOrTextEdits.has(edit),
    );

    this.previewDeferred.resolve(candidate);
    this.clear();
  }

  clearAllEdits(): void {
    this.previewDeferred?.reject();
    this.clear();
  }
}
