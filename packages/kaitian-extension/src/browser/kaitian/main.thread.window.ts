import { Injectable, Autowired } from '@ide-framework/common-di';
import { IRPCProtocol } from '@ide-framework/ide-connection';
import { ExtHostKaitianAPIIdentifier } from '../../common/kaitian';
import { Disposable } from '@ide-framework/ide-core-browser';
import { IMainThreadIDEWindow, IIDEWindowWebviewOptions, IIDEWindowWebviewEnv, IExtHostIDEWindow, IWindowInfo } from '../../common/kaitian/window';
import { IPlainWebviewWindow, IWebviewService } from '@ide-framework/ide-webview';

// 与MainThreadWindow 做一下区分，用于拓展kaitian下的ideWindow API
@Injectable({ multiple: true })
export class MainThreadIDEWindow extends Disposable implements IMainThreadIDEWindow {

  private _proxy: IExtHostIDEWindow;
  // 当前仅支持单个浮动窗口管理及通信
  private _plainWebviewWindowMap: Map<string, IPlainWebviewWindow> = new Map();

  @Autowired(IWebviewService)
  private readonly webviewService: IWebviewService;

  constructor(private rpcProtocol: IRPCProtocol) {
    super();
    this._proxy = this.rpcProtocol.getProxy(ExtHostKaitianAPIIdentifier.ExtHostIDEWindow);
    // 这段逻辑主要是为了在窗口刷新前清理新建webview窗口带来的副作用，可能不是最佳方案
    // 尝试全局卸载过插件副作用，但如主题这类配置的清理，会导致在刷新前做多余的事情
    // 表现为，刷新时主题被重置，后刷新，与预期表现不符
    window.onbeforeunload = () => {
      this.dispose();
    };
  }

  async $createWebviewWindow(webviewId: string, options?: IIDEWindowWebviewOptions, env?: IIDEWindowWebviewEnv): Promise<IWindowInfo> {
    try {
      let window: IPlainWebviewWindow;
      if (this._plainWebviewWindowMap.has(webviewId)) {
        window = this._plainWebviewWindowMap.get(webviewId)!;
      } else {
        window = this.webviewService.createWebviewWindow(options, env);
        if (window) {
          this.disposables.push(window.onMessage((event) => {
            this._proxy.$postMessage(webviewId, event);
          }));
          this.disposables.push(window.onClosed((event) => {
            this._proxy.$dispatchClosed(webviewId);
            // 清理关闭的窗口模拟器
            this.$destroy(webviewId);
          }));
          this.disposables.push(window);
          this._plainWebviewWindowMap.set(webviewId, window);
        }
      }
      await window.ready;
      return {
        windowId: window.windowId,
        webContentsId: window.webContentsId,
      };
    } catch (e) {
      throw e;
    }
  }

  async $show(webviewId: string) {
    if (this._plainWebviewWindowMap.has(webviewId)) {
      const window = this._plainWebviewWindowMap.get(webviewId);
      window?.show();
    }
  }

  async $hide(webviewId: string) {
    if (this._plainWebviewWindowMap.has(webviewId)) {
      const window = this._plainWebviewWindowMap.get(webviewId);
      window?.hide();
    }
  }

  async $setSize(webviewId: string, size: { width: number; height: number; }) {
    if (this._plainWebviewWindowMap.has(webviewId)) {
      const window = this._plainWebviewWindowMap.get(webviewId);
      window?.setSize(size);
    }
  }

  async $postMessage(webviewId: string, message: any) {
    if (this._plainWebviewWindowMap.has(webviewId)) {
      const window = this._plainWebviewWindowMap.get(webviewId);
      window?.postMessage(message);
    }
  }

  async $setAlwaysOnTop(webviewId: string, flag: boolean) {
    if (this._plainWebviewWindowMap.has(webviewId)) {
      const window = this._plainWebviewWindowMap.get(webviewId);
      window?.setAlwaysOnTop(flag);
    }
  }

  async $loadURL(webviewId: string, url: string) {
    if (this._plainWebviewWindowMap.has(webviewId)) {
      const window = this._plainWebviewWindowMap.get(webviewId);
      window?.loadURL(url);
    }
  }

  async $destroy(webviewId: string) {
    if (this._plainWebviewWindowMap.has(webviewId)) {
      const window = this._plainWebviewWindowMap.get(webviewId);
      window?.dispose();
      this._plainWebviewWindowMap.delete(webviewId);
    }
  }

}
