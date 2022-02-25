import { ExtHostAPIIdentifier } from './../../../common/vscode/index';
import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  IExtHostEditorTabsShape,
  IMainThreadEditorTabsShape,
  IEditorTabDto,
} from './../../../common/vscode/editor-tabs';
import { URI, Disposable } from '@opensumi/ide-core-common';
import { Injectable, Autowired, Optional } from '@opensumi/di';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { WorkbenchEditorService } from '@opensumi/ide-editor';

export interface ITabInfo {
  name: string;
  resource: URI;
}

@Injectable({ multiple: true })
export class MainThreadEditorService extends Disposable implements IMainThreadEditorTabsShape {
  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  private readonly proxy: IExtHostEditorTabsShape;

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEditorTabs);

    this.addDispose(this.workbenchEditorService.onDidEditorGroupsChanged(this._pushEditorTabs));
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
          name: group.name,
          resource: resource.uri,
          isActive: this.workbenchEditorService.currentEditorGroup.name === group.name,
        });
      }
    }

    this.proxy.$acceptEditorTabs(tabs);
  }
}
