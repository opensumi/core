import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { IWebviewService } from './types';
import { WebviewServiceImpl } from './webview.service';
import { WebviewModuleContribution } from './contribution';
export * from './types';
export { PlainWebview } from './editor-webview';

@Injectable()
export class WebviewModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IWebviewService,
      useClass: WebviewServiceImpl,
    },
    WebviewModuleContribution,
  ];
}
