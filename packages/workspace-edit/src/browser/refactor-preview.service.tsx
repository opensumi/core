import { action, makeObservable, observable } from 'mobx';
import React from 'react';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { Deferred, MessageType, localize } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IDialogService } from '@opensumi/ide-overlay';
import { ResourceEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';

import { RefactorPreview } from './refactor-preview';

import type {
  IWorkspaceFileEdit,
  IWorkspaceTextEdit,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';

export const PreviewViewId = 'RefactorPreview';

export interface IRefactorPreviewService {
  edits: Array<IWorkspaceTextEdit | IWorkspaceFileEdit>;
  selectedFileOrTextEdits: Set<IWorkspaceTextEdit | IWorkspaceFileEdit>;

  previewEdits(edit: ResourceEdit[]): Promise<ResourceEdit[]>;

  filterEdit(edit: IWorkspaceTextEdit | IWorkspaceFileEdit, checked: boolean): void;

  applyEdits(): void;

  clearAllEdits(): void;
}

export const IRefactorPreviewService = Symbol('IRefactorPreviewService');

@Injectable()
export class RefactorPreviewServiceImpl implements IRefactorPreviewService {
  @observable.shallow
  public edits: Array<IWorkspaceTextEdit | IWorkspaceFileEdit> = [];

  // @ts-expect-error 貌似是 observable 的类型 BUG，和 Set 类型不兼容
  public selectedFileOrTextEdits = observable.set<IWorkspaceTextEdit | IWorkspaceFileEdit>([], { deep: false });

  @Autowired(IMainLayoutService)
  protected readonly mainLayout: IMainLayoutService;

  @Autowired(IDialogService)
  protected readonly dialogService: IDialogService;
  p;
  @Autowired(INJECTOR_TOKEN)
  protected readonly injector: Injector;

  private previewDeferred: Deferred<Array<IWorkspaceTextEdit | IWorkspaceFileEdit>> | null;

  constructor() {
    makeObservable(this);
  }

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
  filterEdit(edit: IWorkspaceTextEdit | IWorkspaceFileEdit, checked: boolean) {
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

    const candidate = this.edits.filter((edit: IWorkspaceTextEdit) => this.selectedFileOrTextEdits.has(edit));

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
