import { Injectable, Autowired } from '@ali/common-di';
import { IMarkdownService } from '../common';
import * as marked from 'marked';
import { markdownCss } from './mardown.style';
import { IWebviewService } from '@ali/ide-webview';
import { URI, IDisposable, Disposable, CancellationToken, Event } from '@ali/ide-core-browser';

@Injectable()
export class MarkdownServiceImpl implements IMarkdownService {

  @Autowired(IWebviewService)
  webviewService: IWebviewService;

  async previewMarkdownInContainer(content: string, container: HTMLElement, cancellationToken: CancellationToken, onUpdate?: Event<string>): Promise<IDisposable> {
    const body = await this.getBody(content);
    if (cancellationToken.isCancellationRequested) {
      return new Disposable();
    }

    const disposer = new Disposable();
    const webviewElement = this.webviewService.createWebview(
      {
        enableFindWidget: true,
        localResourceRoots: [],
      });
    webviewElement.appendTo(container);
    webviewElement.setContent(body);

    disposer.addDispose(webviewElement.onDidClickLink((link) => {
      if (!link) {
        return;
      }
      // Whitelist supported schemes for links
      if (['http', 'https', 'mailto'].indexOf(link.scheme) >= 0 || (link.scheme === 'command')) {
        window.open(link.toString());
      }
    }));
    disposer.addDispose(webviewElement);
    if (onUpdate) {
      disposer.addDispose(onUpdate(async (content) => {
        const body = await this.getBody(content);
        if (!cancellationToken.isCancellationRequested) {
          webviewElement.setContent(body);
        }
      }));
    }

    return disposer;
  }

  async getBody(content): Promise<string> {
    return new Promise((resolve, reject) => {
      marked.parse(content, (err, result) => {
        if (err) {
          reject(err);
        }
        resolve(removeEmbeddedSVGs(renderBody(result)));
      });
    });
  }

}

function renderBody(body: string): string {
  return `<!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="Content-type" content="text/html;charset=UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; script-src 'none'; style-src 'unsafe-inline'; child-src 'none'; frame-src 'none';">
        <style>
          ${markdownCss}
        </style>
      </head>
      <body>
        <a id="scroll-to-top" role="button" aria-label="scroll to top" href="#"><span class="icon"></span></a>
        ${body}
      </body>
    </html>`;
}

function removeEmbeddedSVGs(documentContent: string): string {
  const newDocument = new DOMParser().parseFromString(documentContent, 'text/html');

  // remove all inline svgs
  const allSVGs = newDocument.documentElement.querySelectorAll('svg');
  if (allSVGs) {
    /*tslint:disable */
    for (let i = 0; i < allSVGs.length; i++) {
      const svg = allSVGs[i];
      if (svg.parentNode) {
        svg.parentNode.removeChild(allSVGs[i]);
      }
    }
    /*tslint:enable */
  }

  return newDocument.documentElement.outerHTML;
}
