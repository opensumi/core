import React from 'react';

import { Disposable, DomListener, useInjectable } from '@opensumi/ide-core-browser';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

import { IWebview, IPlainWebview, IEditorWebviewMetaData, IWebviewService, isWebview } from './types';
import { WebviewServiceImpl } from './webview.service';

declare const ResizeObserver: any;
declare const MutationObserver: any;

export const EditorWebviewComponentView: ReactEditorComponent<IEditorWebviewMetaData> = ({ resource }) => {
  const webviewService = useInjectable(IWebviewService) as WebviewServiceImpl;
  const webview = webviewService.editorWebviewComponents.get(resource.metadata!.id)?.webview;
  let container: HTMLDivElement | null = null;

  React.useEffect(() => {
    if (webview && container) {
      const mounter = new WebviewMounter(
        webview,
        container,
        document.getElementById('workbench-editor')!,
        document.getElementById('workbench-editor')!,
      );
      webview.onRemove(() => {
        mounter.dispose();
      });
      return () => {
        webview.remove();
      };
    }
  });

  return (
    <div
      style={{ height: '100%', width: '100%', position: 'relative' }}
      className='editor-webview-webview-component'
      ref={(el) => (container = el)}
    ></div>
  );
};

/**
 * 同一个ID创建的webview会保存在内存以便重复使用，不要使用这个组件进行大量不同webview的创建
 */
export const PlainWebview: React.ComponentType<{ id: string; renderRoot?: HTMLElement; appendToChild?: boolean }> = ({
  id,
  renderRoot = document.body,
  appendToChild,
}) => {
  let container: HTMLDivElement | null = null;
  const webviewService = useInjectable(IWebviewService) as IWebviewService;

  React.useEffect(() => {
    const component = webviewService.getOrCreatePlainWebviewComponent(id);
    if (component && container) {
      if (appendToChild) {
        component.webview.appendTo(container);
      } else {
        const mounter = new WebviewMounter(
          component.webview,
          container,
          document.getElementById('workbench-editor')!,
          renderRoot,
        );
        component.webview.onRemove(() => {
          mounter.dispose();
        });
      }

      return () => {
        component.webview.remove();
      };
    }
  }, []);

  return <div style={{ height: '100%', width: '100%', position: 'relative' }} ref={(el) => (container = el)}></div>;
};

// 将iframe挂载在一个固定的位置，以overlay的形式覆盖在container中，
// 防止它在DOM树改变时被重载
export class WebviewMounter extends Disposable {
  private mounting: number;

  private _container: HTMLElement | null;

  constructor(
    private webview: IWebview | IPlainWebview,
    private container: HTMLElement,
    mutationRoot: HTMLElement,
    private renderRoot: HTMLElement = document.body,
  ) {
    super();
    if (!this.webview.getDomNode()) {
      return;
    }
    this.webview.appendTo(this.getWebviewRealContainer());
    if (isWebview(this.webview)) {
      this.webview.setKeybindingDomTarget(container);
    }
    const resizeObserver = new ResizeObserver(this.doMount.bind(this));
    const mutationObserver = new MutationObserver((mutations) => {
      const ancestors: Set<HTMLElement> = new Set();
      let ancestor: HTMLElement | null = this.container;
      while (ancestor && ancestor !== mutationRoot) {
        ancestors.add(ancestor);
        ancestor = ancestor.parentElement;
      }
      for (const { addedNodes, removedNodes } of mutations) {
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
    mutationObserver.observe(mutationRoot, { childList: true, subtree: true });

    this.doMount();

    this.addDispose({
      dispose: () => {
        if (this._container) {
          this._container.remove();
          this._container = null;
          this.webview = null as any;
          this.container = null as any;
        }
        resizeObserver.disconnect();
        mutationObserver.disconnect();
      },
    });

    this.addDispose(
      new DomListener(window, 'resize', () => {
        this.doMount();
      }),
    );

    // 监听滚动
    let parent = container.parentElement;
    while (parent) {
      this.addDispose(
        new DomListener(parent, 'scroll', () => {
          this.doMount();
        }),
      );
      parent = parent.parentElement;
    }
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
        if (isWebview(this.webview) && !this.webview.options.longLive) {
          this.webview.setListenMessages(false);
        }
      } else {
        this.webview.getDomNode()!.style.display = '';
        if (isWebview(this.webview)) {
          this.webview.setListenMessages(true);
        }
      }
      const renderRootRects = this.renderRoot.getBoundingClientRect();
      this.webview.getDomNode()!.style.top = rect.top - renderRootRects.top + 'px';
      this.webview.getDomNode()!.style.left = rect.left - renderRootRects.left + 'px';
      this.webview.getDomNode()!.style.height = rect.height + 'px';
      this.webview.getDomNode()!.style.width = rect.width + 'px';
      this.mounting = 0;
    });
  }

  getWebviewRealContainer() {
    if (this._container) {
      return this._container;
    }
    let mountContainer = this.renderRoot.querySelector(':scope > div[data-webview-container=true]');
    if (!mountContainer) {
      const container = document.createElement('div');
      container.style.zIndex = '2';
      container.style.position = 'absolute';
      container.setAttribute('data-webview-container', 'true');
      container.style.top = '0';
      this.renderRoot.appendChild(container);
      mountContainer = container;
    }
    this._container = document.createElement('div');
    mountContainer!.appendChild(this._container);
    return this._container!;
  }
}
