import { defaultCss, IWebviewChannel, getVsCodeApiScript } from './common';

export class WebviewPanelManager {
  private activeTheme = 'default';
  private styles: { [key: string]: string };
  private isHandlingScroll = false;
  private updateId = 0;
  private firstLoad = true;
  private loadTimeout;
  private pendingMessages: any[] = [];
  private initialScrollProgress: number;
  private ID: string | undefined;

  constructor(private channel: IWebviewChannel) {
    document.addEventListener('DOMContentLoaded', this.init.bind(this));
  }

  private init() {
    const idMatch = document.location.search.match(/\bid=([\w-]+)/);
    this.ID = idMatch ? idMatch[1] : undefined;
    if (!document.body) {
      return;
    }

    this.channel.onMessage('styles', (_event, data) => {
      this.styles = data.styles;
      this.activeTheme = data.activeTheme;

      const target = this.getActiveFrame();
      if (!target) {
        return;
      }

      if (target.contentDocument) {
        this.applyStyles(target.contentDocument, target.contentDocument.body);
      }
    });

    // propagate focus
    this.channel.onMessage('focus', () => {
      const target = this.getActiveFrame();
      if (target && target.contentWindow) {
        target.contentWindow.focus();
      }
    });

    this.channel.onMessage('content', async (_event, data) => this.setContent(data));

    this.channel.onMessage('message', (_event, data) => {
      const pending = this.getPendingFrame();
      if (!pending) {
        const target = this.getActiveFrame();
        if (target) {
          target.contentWindow!.postMessage(data, '*');
          return;
        }
      }
      this.pendingMessages.push(data);
    });

    this.trackFocus({
      onFocus: () => this.channel.postMessage('did-focus'),
      onBlur: () => this.channel.postMessage('did-blur'),
    });

    this.channel.postMessage('webview-ready', {});
  }

  private async setContent(data) {
    const currentUpdateId = ++this.updateId;
    await this.channel.ready;
    if (currentUpdateId !== this.updateId) {
      return;
    }

    const options = data.options;
    const newDocument = this.toContentHtml(data);

    const frame = this.getActiveFrame();
    const wasFirstLoad = this.firstLoad;
    // keep current scrollY around and use later
    let setInitialScrollPosition;
    if (this.firstLoad) {
      this.firstLoad = false;
      setInitialScrollPosition = (body, window) => {
        if (!isNaN(this.initialScrollProgress)) {
          if (window.scrollY === 0) {
            window.scroll(0, body.clientHeight * this.initialScrollProgress);
          }
        }
      };
    } else {
      const scrollY = frame && frame.contentDocument && frame.contentDocument.body ? frame.contentWindow!.scrollY : 0;
      setInitialScrollPosition = (body, window) => {
        if (window.scrollY === 0) {
          window.scroll(0, scrollY);
        }
      };
    }

    // Clean up old pending frames and set current one as new one
    const previousPendingFrame = this.getPendingFrame();
    if (previousPendingFrame) {
      previousPendingFrame.setAttribute('id', '');
      document.body.removeChild(previousPendingFrame);
    }
    if (!wasFirstLoad) {
      this.pendingMessages = [];
    }

    const newFrame = document.createElement('iframe');
    newFrame.setAttribute('id', 'pending-frame');
    newFrame.setAttribute('frameborder', '0');
    newFrame.setAttribute('allow', 'autoplay');

    const sandboxRules = new Set(['allow-same-origin', 'allow-pointer-lock']);
    if (options.allowScripts) {
      sandboxRules.add('allow-scripts');
      sandboxRules.add('allow-downloads');
    }
    if (options.allowForms) {
      sandboxRules.add('allow-forms');
    }
    newFrame.setAttribute('sandbox', Array.from(sandboxRules).join(' '));
    if (this.channel.fakeLoad) {
      // 使用service-worker时候
      newFrame.src = `./fake.html?id=${this.ID}`;
    }
    newFrame.style.cssText =
      'display: block; margin: 0; overflow: hidden; position: absolute; width: 100%; height: 100%; visibility: hidden';
    document.body.appendChild(newFrame);

    if (!this.channel.fakeLoad) {
      // write new content onto iframe
      newFrame.contentDocument!.open();
    }

    newFrame.contentWindow!.addEventListener('keydown', this.handleInnerKeydown.bind(this));

    newFrame.contentWindow!.addEventListener('DOMContentLoaded', (e) => {
      if (this.channel.fakeLoad) {
        newFrame.contentDocument!.open();
        newFrame.contentDocument!.write(newDocument);
        newFrame.contentDocument!.close();
        hookupOnLoadHandlers(newFrame);
      }
      const contentDocument: HTMLDocument | undefined = e.target ? (e.target as HTMLDocument) : undefined;
      if (contentDocument) {
        this.applyStyles(contentDocument, contentDocument.body);
      }
    });

    const onLoad = (contentDocument, contentWindow) => {
      if (contentDocument && contentDocument.body) {
        // Workaround for https://github.com/Microsoft/vscode/issues/12865
        // check new scrollY and reset if neccessary
        setInitialScrollPosition(contentDocument.body, contentWindow);
      }

      const newFrame = this.getPendingFrame();
      if (newFrame && newFrame.contentDocument && newFrame.contentDocument === contentDocument) {
        const oldActiveFrame = this.getActiveFrame();
        if (oldActiveFrame) {
          document.body.removeChild(oldActiveFrame);
        }
        // Styles may have changed since we created the element. Make sure we re-style
        this.applyStyles(newFrame.contentDocument, newFrame.contentDocument.body);
        newFrame.setAttribute('id', 'active-frame');
        newFrame.style.visibility = 'visible';
        if (this.channel.focusIframeOnCreate) {
          newFrame.contentWindow!.focus();
        }

        contentWindow.addEventListener('scroll', this.handleInnerScroll.bind(this));

        this.pendingMessages.forEach((data) => {
          contentWindow.postMessage(data, '*');
        });
        this.pendingMessages = [];
      }
    };

    /**
     * @param {HTMLIFrameElement} newFrame
     */
    const hookupOnLoadHandlers = (newFrame) => {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = undefined;
      this.loadTimeout = setTimeout(() => {
        clearTimeout(this.loadTimeout);
        this.loadTimeout = undefined;
        onLoad(newFrame.contentDocument, newFrame.contentWindow);
      }, 1000);

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const _this = this;
      newFrame.contentWindow.addEventListener('load', function (this: any, e) {
        if (_this.loadTimeout) {
          clearTimeout(_this.loadTimeout);
          _this.loadTimeout = undefined;
          onLoad(e.target, this);
        }
      });

      // Bubble out link clicks
      newFrame.contentWindow.addEventListener('click', this.handleInnerClick.bind(this));

      if (this.channel.onIframeLoaded) {
        this.channel.onIframeLoaded(newFrame);
      }
    };

    if (!this.channel.fakeLoad) {
      hookupOnLoadHandlers(newFrame);
    }

    if (!this.channel.fakeLoad) {
      newFrame.contentDocument!.write(newDocument);
      newFrame.contentDocument!.close();
    }

    this.channel.postMessage('did-set-content', undefined);
  }

  private trackFocus({ onFocus, onBlur }): void {
    const interval = 50;
    let isFocused = document.hasFocus();
    setInterval(() => {
      const isCurrentlyFocused = document.hasFocus();
      if (isCurrentlyFocused === isFocused) {
        return;
      }
      isFocused = isCurrentlyFocused;
      if (isCurrentlyFocused) {
        onFocus();
      } else {
        onBlur();
      }
    }, interval);
  }

  private getActiveFrame(): HTMLIFrameElement | undefined {
    return document.getElementById('active-frame') as HTMLIFrameElement;
  }

  private getPendingFrame(): HTMLIFrameElement | undefined {
    return document.getElementById('pending-frame') as HTMLIFrameElement;
  }

  private get defaultCssRules() {
    return defaultCss;
  }

  private applyStyles(document, body) {
    if (!document) {
      return;
    }

    if (body) {
      body.classList.remove('vscode-light', 'vscode-dark', 'vscode-high-contrast');
      body.classList.add(this.activeTheme);
    }

    if (this.styles) {
      for (const variable of Object.keys(this.styles)) {
        document.documentElement.style.setProperty(`--${variable}`, this.styles[variable]);
      }
    }
  }

  private handleInnerClick(event: MouseEvent) {
    if (!event || !event.view || !event.view.document) {
      return;
    }

    const baseElement = event.view.document.getElementsByTagName('base')[0];
    let node = event.target as any;
    while (node) {
      if (node.tagName && node.tagName.toLowerCase() === 'a' && node.href) {
        if (node.getAttribute('href') === '#') {
          event.view.scrollTo(0, 0);
        } else if (
          node.hash &&
          (node.getAttribute('href') === node.hash || (baseElement && node.href.indexOf(baseElement.href) >= 0))
        ) {
          const scrollTarget = event.view.document.getElementById(node.hash.substr(1, node.hash.length - 1));
          if (scrollTarget) {
            scrollTarget.scrollIntoView();
          }
        } else {
          this.channel.postMessage('did-click-link', node.href.baseVal || node.href);
        }
        event.preventDefault();
        break;
      }
      node = node.parentNode;
    }
  }

  private handleInnerKeydown(e) {
    this.channel.postMessage('did-keydown', {
      key: e.key,
      keyCode: e.keyCode,
      code: e.code,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      repeat: e.repeat,
    });
    this.channel.onKeydown && this.channel.onKeydown(e);
  }

  private handleInnerScroll(event) {
    if (!event.target || !event.target.body) {
      return;
    }
    if (this.isHandlingScroll) {
      return;
    }

    const progress = event.currentTarget.scrollY / event.target.body.clientHeight;
    if (isNaN(progress)) {
      return;
    }

    this.isHandlingScroll = true;
    window.requestAnimationFrame(() => {
      try {
        this.channel.postMessage('did-scroll', progress);
      } catch (e) {
        // noop
      }
      this.isHandlingScroll = false;
    });
  }

  private toContentHtml(data) {
    const options = data.options;
    const text = data.contents;
    const newDocument = new DOMParser().parseFromString(text, 'text/html');

    newDocument.querySelectorAll('a').forEach((a) => {
      if (!a.title) {
        a.title = a.getAttribute('href')!;
      }
    });

    // apply default script
    if (options.allowScripts) {
      const defaultScript = newDocument.createElement('script');
      defaultScript.textContent = getVsCodeApiScript(data.state);
      newDocument.head.prepend(defaultScript);
    }

    // apply default styles
    const defaultStyles = newDocument.createElement('style');
    defaultStyles.id = '_defaultStyles';
    defaultStyles.innerHTML = this.defaultCssRules;
    newDocument.head.prepend(defaultStyles);

    this.applyStyles(newDocument, newDocument.body);

    // set DOCTYPE for newDocument explicitly as DOMParser.parseFromString strips it off
    // and DOCTYPE is needed in the iframe to ensure that the user agent stylesheet is correctly overridden
    return '<!DOCTYPE html>\n' + newDocument.documentElement.outerHTML;
  }
}
