import React from 'react';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Deferred, MessageType, localize } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IObservable, observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';
import { IDialogService } from '@opensumi/ide-overlay';
import { ResourceEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';

import { RefactorPreview } from './refactor-preview';

import type {
  IWorkspaceFileEdit,
  IWorkspaceTextEdit,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

export const PreviewViewId = 'RefactorPreview';

export interface IRefactorPreviewService {
  edits: IObservable<Array<WorkspaceEditModel>>;

  previewEdits(edit: ResourceEdit[]): Promise<ResourceEdit[]>;

  filterEdit(edit: WorkspaceEditModel, checked: boolean): void;

  applyEdits(): void;

  clearAllEdits(): void;
}

export const IRefactorPreviewService = Symbol('IRefactorPreviewService');

export class WorkspaceEditModel {
  constructor(private raw: ResourceEdit) {}

  get edit() {
    return this.raw;
  }

  readonly isChecked = observableValue<boolean>(this, true);
}

@Injectable()
export class RefactorPreviewServiceImpl implements IRefactorPreviewService {
  @Autowired(IMainLayoutService)
  protected readonly mainLayout: IMainLayoutService;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;
  p;
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  private previewDeferred: Deferred<Array<IWorkspaceTextEdit | IWorkspaceFileEdit>> | null;

  public readonly edits = observableValue<Array<WorkspaceEditModel>>(this, []);

  private clear() {
    this.togglePreviewView(false);
    this.previewDeferred = null;

    transaction((tx) => {
      this.edits.set([], tx);
    });
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
      const continued = await this.dialogService.open({
        message: (
          <div>
            {localize('refactor-preview.overlay.title')}
            <p>{localize('refactor-preview.overlay.detail')}</p>
          </div>
        ),
        type: MessageType.Warning,
        buttons: [localize('refactor-preview.overlay.cancel'), localize('refactor-preview.overlay.continue')],
      });

      if (continued === localize('refactor-preview.overlay.cancel')) {
        return [];
      }
    }

    this.togglePreviewView(true);

    transaction((tx) => {
      this.edits.set(
        edits.map((edit) => new WorkspaceEditModel(edit)),
        tx,
      );
    });

    this.previewDeferred = new Deferred();

    return this.previewDeferred.promise;
  }

  filterEdit(edit: WorkspaceEditModel, checked: boolean) {
    transaction((tx) => {
      edit.isChecked.set(checked, tx);
    });
  }

  applyEdits(): void {
    if (!this.previewDeferred) {
      // it's can not be happened
      return;
    }

    const candidate = this.edits.get().filter((edit) => edit.isChecked.get());

    this.previewDeferred.resolve(candidate.map((edit) => edit.edit));
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
