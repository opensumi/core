import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { WebviewModuleContribution } from './contribution';
import { ElectronWebviewModuleContribution } from './electron.contribution';
import { IWebviewService } from './types';
import { WebviewServiceImpl } from './webview.service';
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
  electronProviders: Provider[] = [ElectronWebviewModuleContribution];
}
