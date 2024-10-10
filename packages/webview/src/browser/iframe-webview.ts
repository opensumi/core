import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, Disposable, DomListener, IDisposable, URI, getDebugLogger } from '@opensumi/ide-core-browser';

import { AbstractWebviewPanel } from './abstract-webview';
import { createHTML } from './iframe/prebuilt';
import { IWebview, IWebviewContentOptions } from './types';

@Injectable({ multiple: true })
export class IFrameWebviewPanel extends AbstractWebviewPanel implements IWebview {
  private iframe: HTMLIFrameElement;

  private _needReload = false;

  private _iframeDisposer: Disposable | null = new Disposable();

  private _isReady: boolean;

  @Autowired(AppConfig)
  config: AppConfig;

  constructor(public readonly id: string, options: IWebviewContentOptions = {}) {
    super(id, options);

    this.iframe = document.createElement('iframe');
    this.iframe.name = `webview-${this.id}`;
    this.iframe.id = `webview-${this.id}`;

    this.iframe.setAttribute('allow', 'autoplay');

    const sandboxRules = new Set(['allow-same-origin', 'allow-scripts']);

    if (options.allowForms) {
      sandboxRules.add('allow-forms');
    }
    this.iframe.setAttribute('sandbox', Array.from(sandboxRules).join(' '));

    if (this.config.useBuiltinWebview || !this.config.webviewEndpoint) {
      this.iframe.setAttribute('srcdoc', createHTML(this.id));
    } else {
      this.iframe.setAttribute('src', `${this.config.webviewEndpoint}/index.html?id=${this.id}`);
    }

    this.iframe.style.border = 'none';
    this.iframe.style.width = '100%';
    this.iframe.style.position = 'absolute';
    this.iframe.style.height = '100%';
    this.iframe.style.zIndex = '2';

    super.init();
  }

  prepareContainer() {
    this.clear();
    this._iframeDisposer = new Disposable();
    this._ready = new Promise<void>((resolve) => {
      this._onWebviewMessage('webview-ready', () => {
        if (this._isReady) {
          // 这种情况一般是由于iframe在dom中的位置变动导致了重载。
          // 此时我们需要重新初始化
          this.initEvents();
          this.doUpdateContent();
        }
        this._isReady = true;
        resolve();
      });
    });
    this._needReload = false;
  }

  getDomNode() {
    return this.iframe;
  }

  protected _sendToWebview(channel: string, data: any) {
    if (!this._isListening) {
      return;
    }
    this._ready
      .then(() => {
        if (!this.iframe) {
          return;
        }
        this.iframe.contentWindow!.postMessage(
          {
            channel,
            data,
          },
          '*',
        );
      })
      .catch((err) => {
        getDebugLogger().error(err);
      });
  }

  protected _onWebviewMessage(channel: string, listener: (data: any) => any): IDisposable {
    return this._iframeDisposer!.addDispose(
      new DomListener(window, 'message', (e) => {
        if (e.data && e.data.target === this.id && e.data.channel === channel) {
          if (!this._isListening) {
            return;
          }
          listener(e.data.data);
        }
      }),
    );
  }

  appendTo(container: HTMLElement) {
    if (this.iframe) {
      if (container.style.position === 'static' || !container.style.position) {
        container.style.position = 'relative';
      }
      container.innerHTML = '';
      container.appendChild(this.iframe);
      if (this._needReload) {
        this.init();
        this.doUpdateContent();
      }
    }
  }

  protected preprocessHtml(html: string): string {
    return html.replace(
      /(["'])vscode-resource:([^\s'"]+?)(["'])/gi,
      (_, startQuote, path, endQuote) =>
        `${startQuote}${this.staticResourceService.resolveStaticResource(URI.file(path))}${endQuote}`,
    );
  }

  remove() {
    if (this.iframe) {
      this.iframe.remove();
      this._onRemove.fire();
      // remove 只是视图被销毁，但是html，state等内容保留，因此这里之前是改坏了
      // this.dispose();
      this.clear();
      this._needReload = true;
    }
  }

  clear() {
    if (this._iframeDisposer) {
      this._iframeDisposer.dispose();
      this._iframeDisposer = null;
    }
    this._isReady = false;
  }

  dispose() {
    super.dispose();
    if (this._iframeDisposer) {
      this._iframeDisposer.dispose();
    }
  }
}
