import { Injectable, Autowired, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { URI, Disposable } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

import {
  IExtHostEditorTabsShape,
  IMainThreadEditorTabsShape,
  IEditorTabDto,
} from './../../../common/vscode/editor-tabs';
import { ExtHostAPIIdentifier } from './../../../common/vscode/index';

export interface ITabInfo {
  name: string;
  resource: URI;
}

@Injectable({ multiple: true })
export class MainThreadEditorTabsService extends Disposable implements IMainThreadEditorTabsShape {
  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  private readonly proxy: IExtHostEditorTabsShape;

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEditorTabs);

    this.addDispose(
      this.workbenchEditorService.onDidEditorGroupsChanged(() => {
        this._pushEditorTabs();
      }),
    );
    this.addDispose(
      this.workbenchEditorService.onActiveResourceChange(() => {
        this._pushEditorTabs();
      }),
    );
    this.workbenchEditorService.contributionsReady.promise.then(() => {
      this._pushEditorTabs();
    });
  }

  private _pushEditorTabs(): void {
    const tabs: IEditorTabDto[] = [];
    for (const group of this.workbenchEditorService.editorGroups) {
      for (const resource of group.resources) {
        if (group.disposed || !resource) {
          continue;
        }
        tabs.push({
          group: group.index,
          name: resource.name,
          resource: resource.uri.toString(),
          isActive: this.workbenchEditorService.currentResource?.uri === resource.uri,
        });
      }
    }

    this.proxy.$acceptEditorTabs(tabs);
  }
}
