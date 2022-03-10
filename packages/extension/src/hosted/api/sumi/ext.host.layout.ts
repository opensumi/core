import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter } from '@opensumi/ide-core-common';

import { MainThreadSumiAPIIdentifier } from '../../../common/sumi';
import { ITabbarHandler, IMainThreadLayout, IExtHostLayout } from '../../../common/sumi/layout';
import { IExtHostCommands, IExtensionDescription } from '../../../common/vscode';


export class TabbarHandler implements ITabbarHandler {
  public readonly onActivateEmitter = new Emitter<void>();
  public readonly onActivate = this.onActivateEmitter.event;

  public readonly onInActivateEmitter = new Emitter<void>();
  public readonly onInActivate = this.onInActivateEmitter.event;

  constructor(public id: string, private proxy: IMainThreadLayout) {}

  setTitle(title: string): void {
    this.proxy.$setTitle(this.id, title);
  }

  setIcon(iconPath: string): void {
    this.proxy.$setIcon(this.id, iconPath);
  }

  setSize(size: number): void {
    this.proxy.$setSize(this.id, size);
  }

  activate(): void {
    this.proxy.$activate(this.id);
  }

  deactivate(): void {
    this.proxy.$deactivate(this.id);
  }

  setVisible(visible: boolean) {
    this.proxy.$setVisible(this.id, visible);
  }

  setBadge(badge: string) {
    this.proxy.$setBadge(this.id, badge);
  }

  isAttached(): Promise<boolean> {
    return this.proxy.$isAttached(this.id);
  }
}

export class ExtHostLayout implements IExtHostLayout {
  private handles: Map<string, TabbarHandler> = new Map();

  private proxy: IMainThreadLayout;

  constructor(private rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this.proxy = this.rpcProtocol.getProxy(MainThreadSumiAPIIdentifier.MainThreadLayout);
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
  extension: IExtensionDescription,
) {
  return {
    toggleBottomPanel: async (size?: number) =>
      await extHostCommands.executeCommand('main-layout.bottom-panel.toggle', undefined, size),
    toggleLeftPanel: async (size?: number) =>
      await extHostCommands.executeCommand('main-layout.left-panel.toggle', undefined, size),
    toggleRightPanel: async (size?: number) =>
      await extHostCommands.executeCommand('main-layout.right-panel.toggle', undefined, size),
    showRightPanel: async (size?: number) =>
      await extHostCommands.executeCommand('main-layout.right-panel.toggle', true, size),
    hideRightPanel: async () => await extHostCommands.executeCommand('main-layout.right-panel.toggle', false),
    activatePanel: async (id) => await extHostCommands.executeCommand(`workbench.view.extension.${id}`),
    isBottomPanelVisible: async () => await extHostCommands.executeCommand('main-layout.bottom-panel.is-visible'),
    isLeftPanelVisible: async () => await extHostCommands.executeCommand('main-layout.left-panel.is-visible'),
    isRightPanelVisible: async () => await extHostCommands.executeCommand('main-layout.right-panel.is-visible'),
    getTabbarHandler: (id: string) => kaitianLayout.getTabbarHandler(extension.id + ':' + id),
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
