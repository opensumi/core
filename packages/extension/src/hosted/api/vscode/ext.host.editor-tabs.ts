import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Event, URI, Uri } from '@opensumi/ide-core-common';

import {
  IExtHostEditorTabs,
  IEditorTab,
  IEditorTabDto,
  IMainThreadEditorTabsShape,
} from './../../../common/vscode/editor-tabs';
import { MainThreadAPIIdentifier } from './../../../common/vscode/index';

export class ExtHostEditorTabs implements IExtHostEditorTabs {
  private _proxy: IMainThreadEditorTabsShape;
  readonly _serviceBrand: undefined;

  private readonly _onDidChangeTabs = new Emitter<void>();
  readonly onDidChangeTabs: Event<void> = this._onDidChangeTabs.event;

  private _tabs: IEditorTab[] = [];

  get tabs(): readonly IEditorTab[] {
    return this._tabs;
  }

  constructor(rpcProtocol: IRPCProtocol) {
    this._proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadEditorTabs);
  }

  $acceptEditorTabs(tabs: IEditorTabDto[]): void {
    this._tabs = tabs.map((dto) => ({
      name: dto.name,
      group: dto.group,
      resource: Uri.parse(dto.resource),
      isActive: dto.isActive,
    }));
    this._onDidChangeTabs.fire();
  }
}
