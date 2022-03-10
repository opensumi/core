import { CancellationTokenSource, Emitter, Disposable } from '@opensumi/ide-core-common';
import { IMarkdownService } from '@opensumi/ide-markdown';
import { MarkdownModule } from '@opensumi/ide-markdown/lib/browser';
import { IWebviewService, IWebview } from '@opensumi/ide-webview';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';

describe('markdown test', () => {
  const injector = createBrowserInjector([MarkdownModule]);

  injector.addProviders({
    token: IWebviewService,
    useValue: {},
  });

  it('markdown service test', async (done) => {
    const webview = new MockedWebviewElement();
    injector.mock(IWebviewService, 'createWebview', () => webview);

    const markdownService: IMarkdownService = injector.get(IMarkdownService);

    const element = document.createElement('div');
    const markdownString = '### h1Content \n\n* list element1\n* list element2';
    const updateEvent = new Emitter<string>();
    await markdownService.previewMarkdownInContainer(
      markdownString,
      element,
      new CancellationTokenSource().token,
      updateEvent.event,
    );

    expect(webview.appendTo).toBeCalledWith(element);
    expect(webview.setContent).toBeCalledTimes(1);
    expect(webview.content).toContain('<li>');
    expect(webview.content).toContain('h1Content');
    expect(webview.content).toContain('list element1');

    expect(webview.onDidClickLink).toBeCalledTimes(1);

    await updateEvent.fireAndAwait('## h2Content');
    expect(webview.content).toContain('h2Content');

    done();
  });
});

class MockedWebviewElement extends Disposable implements Partial<IWebview> {
  appendTo = jest.fn();

  public content = '';

  setContent = jest.fn((content: string) => {
    this.content = content;
  }) as any;

  _onDidClickLink = new Emitter<any>();
  onDidClickLink = jest.fn(this._onDidClickLink.event);
}
