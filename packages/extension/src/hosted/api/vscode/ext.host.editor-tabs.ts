import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, Event, URI, Uri } from '@opensumi/ide-core-common';
import { IExtHostEditorTabs, IEditorTab, IEditorTabDto } from './../../../common/vscode/editor-tabs';

export class ExtHostEditorTabs implements IExtHostEditorTabs {
  readonly _serviceBrand: undefined;

  private readonly _onDidChangeTabs = new Emitter<void>();
  readonly onDidChangeTabs: Event<void> = this._onDidChangeTabs.event;

  private _tabs: IEditorTab[] = [];

  get tabs(): readonly IEditorTab[] {
    return this._tabs;
  }

  constructor(rpcProtocol: IRPCProtocol) {
    // this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadDecorations);
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
