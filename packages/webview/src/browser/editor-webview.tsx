import * as React from 'react';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { IWebview, IPlainWebview, IEditorWebviewComponent, IEditorWebviewMetaData } from './types';
import { IDisposable, Disposable, DomListener } from '@ali/ide-core-browser';

declare const ResizeObserver: any;
declare const MutationObserver: any;

const WEBVIEW_OVERLAY_CONTAINER_ID = ' webview-overlay-container';

export const EditorWebviewComponentView: ReactEditorComponent<IEditorWebviewMetaData> = ({resource}) => {

  const webview = resource && resource.metadata && resource.metadata.editorWebview.webview;
  let container: HTMLDivElement | null = null;

  React.useEffect(() => {
    if (webview && container) {
      const mounter = new WebviewMounter(webview, container, document.getElementById('workbench-editor')!);
      webview.onRemove(() => {
        mounter.dispose();
      });
      return () => {
        webview.remove();
      };
    }
  });

  return <div style={{height: '100%'}} ref = {(el) => container = el}></div>;

};

// 将iframe挂载在一个固定的位置，以overlay的形式覆盖在container中，
// 防止它在DOM树改变时被重载
class WebviewMounter extends Disposable {

  private mounting: number;

  private _container: HTMLElement | null;

  constructor(private webview: IWebview | IPlainWebview, private container: HTMLElement, private mutationRoot: HTMLElement) {
    super();
    if (!this.webview.getDomNode()) {
      return;
    }
    this.webview.appendTo(this.getWebviewRealContainer());
    const resizeObserver = new ResizeObserver(this.doMount.bind(this));
    const mutationObserver = new MutationObserver((mutations) => {
      const ancestors: Set<HTMLElement> = new Set();
      let ancestor: HTMLElement | null = this.container;
      while (ancestor && ancestor !== mutationRoot) {
        ancestors.add(ancestor);
        ancestor = ancestor.parentElement;
      }
      for (const { addedNodes, removedNodes} of mutations) {
        for (const node of addedNodes) {
          if (ancestors.has(node)) {
            this.doMount();
            return;
          }
        }
        for (const node of removedNodes) {
          if (ancestors.has(node)) {
            this.doMount();
            return;
          }
        }
      }

    });
    resizeObserver.observe(container);
    mutationObserver.observe(mutationRoot, {childList: true, subtree: true});

    this.doMount();

    this.addDispose({
      dispose: () => {
        if (this._container) {
          this._container.remove();
          this._container = null;
          this.webview  = null as any;
          this.container = null as any;
          this.mutationRoot = null as any;
        }
        resizeObserver.disconnect();
        mutationObserver.disconnect();
      },
    });

    this.addDispose(new DomListener(window, 'resize', () => {
      this.doMount();
    }));
  }

  doMount() {
    if (this.mounting) {
      window.cancelAnimationFrame(this.mounting);
    }
    this.mounting = window.requestAnimationFrame(() => {
      if (!this.webview.getDomNode()) {
        return;
      }
      const rect = this.container.getBoundingClientRect();
      if (rect.height === 0 || rect.width === 0) {
        this.webview.getDomNode()!.style.display = 'none';
        if (isWebview(this.webview)) {
          this.webview.setListenMessages(false);
        }
      } else {
        this.webview.getDomNode()!.style.display = '';
        if (isWebview(this.webview)) {
          this.webview.setListenMessages(true);
        }
      }
      this.webview.getDomNode()!.style.top = rect.top + 'px';
      this.webview.getDomNode()!.style.left = rect.left + 'px';
      this.webview.getDomNode()!.style.height = rect.height + 'px';
      this.webview.getDomNode()!.style.width = rect.width + 'px';
      this.mounting = 0;
    });
  }

  getWebviewRealContainer() {
    if (this._container) {
      return this._container;
    }
    if (!document.getElementById(WEBVIEW_OVERLAY_CONTAINER_ID)) {
      const container = document.createElement('div');
      container.id = WEBVIEW_OVERLAY_CONTAINER_ID;
      document.body.appendChild(container);
    }
    this._container = document.createElement('div');
    document.getElementById(WEBVIEW_OVERLAY_CONTAINER_ID)!.appendChild(this._container);
    return this._container!;
  }

}

function isWebview(webview: IWebview | IPlainWebview): webview is IWebview {
  return !!(webview as IWebview).setContent;
}
