import { IExtHostCommands } from '../../../common/vscode';
import { ITabbarHandler, IMainThreadLayout, IExtHostLayout } from '../../../common/kaitian/layout';
import { Disposable, Emitter, stringify } from '@ali/ide-core-common';
import { MainThreadKaitianAPIIdentifier } from '../../../common/kaitian';
import { IRPCProtocol } from '@ali/ide-connection';
import { IExtension } from '../../../common';

export class TabbarHandler implements ITabbarHandler {
  public readonly onActivateEmitter = new Emitter<void>();
  public readonly onActivate = this.onActivateEmitter.event;

  public readonly onInActivateEmitter = new Emitter<void>();
  public readonly onInActivate = this.onInActivateEmitter.event;

  constructor(public id: string, private proxy: IMainThreadLayout) {}

  setSize(size: number): void {
    this.proxy.$setSize(this.id, size);
  }

  activate(): void {
    this.proxy.$activate(this.id);
  }

  deactivate(): void {
    this.proxy.$deactivate(this.id);
  }

}

export class KaitianExtHostLayout implements IExtHostLayout {
  private handles: Map<string, TabbarHandler> = new Map();

  private proxy: IMainThreadLayout;

  constructor(private rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadKaitianAPIIdentifier.MainThreadLayout);
  }

  getTabbarHandler(id: string): ITabbarHandler {
    if (!this.handles.has(id)) {
      this.proxy.$connectTabbar(id);
      this.handles.set(id, new TabbarHandler(id, this.proxy));
    }
    return this.handles.get(id)!;
  }

  $acceptMessage(id: string, type: 'activate' | 'deactivate') {
    const handle = this.handles.get(id)!;
    if (type === 'activate') {
      handle.onActivateEmitter.fire();
    } else if (type === 'deactivate') {
      handle.onInActivateEmitter.fire();
    }
  }
}

export function createLayoutAPIFactory(
  extHostCommands: IExtHostCommands,
  kaitianLayout: IExtHostLayout,
  extension: IExtension,
) {
  return {
    toggleBottomPanel: async () => {
      return await extHostCommands.executeCommand('main-layout.bottom-panel.toggle');
    },
    toggleLeftPanel: async () => {
      return await extHostCommands.executeCommand('activity-bar.left.toggle');
    },
    toggleRightPanel: async () => {
      return await extHostCommands.executeCommand('activity-bar.right.toggle');
    },
    showRightPanel: async () => {
      return await extHostCommands.executeCommand('activity-bar.right.toggle', true);
    },
    hideRightPanel: async () => {
      return await extHostCommands.executeCommand('activity-bar.right.toggle', false);
    },
    activatePanel: async (id) => {
      return await extHostCommands.executeCommand(`workbench.view.${id}`);
    },
    isBottomPanelVisible: async () => {
      return await extHostCommands.executeCommand('main-layout.bottom-panel.is-visible');
    },
    isLeftPanelVisible: async () => {
      return await extHostCommands.executeCommand('main-layout.left-panel.is-visible');
    },
    isRightPanelVisible: async () => {
      return await extHostCommands.executeCommand('main-layout.right-panel.is-visible');
    },
    getTabbarHandler: (id: string) => {
      return kaitianLayout.getTabbarHandler( extension.id + ':' + id);
    },
    // 为了获取其他插件注册的tabbarHandler
    getExtensionTabbarHandler: (id: string, extensionId?: string) => {
      if (extensionId) {
        return kaitianLayout.getTabbarHandler(extensionId + ':' + id);
      } else {
        return kaitianLayout.getTabbarHandler(id);
      }
    },
  };
}
