import { IWebviewService, IPlainWebviewConstructionOptions, IPlainWebview } from './types';
import { isElectronRenderer, getLogger, localize } from '@ali/ide-core-browser';
import { ElectronPlainWebview, IframePlainWebview } from './plain-weview';
import { Injectable } from '@ali/common-di';

@Injectable()
export class WebviewServiceImpl implements IWebviewService {

  createPlainWebview(options: IPlainWebviewConstructionOptions = {}): IPlainWebview {

    if (isElectronRenderer()) {
      if (options.preferredImpl && options.preferredImpl === 'iframe') {
        return new IframePlainWebview();
      }
      return new ElectronPlainWebview();
    } else {
      if (options.preferredImpl && options.preferredImpl === 'webview') {
        getLogger().warn(localize('webview.webviewTagUnavailable', '无法在非Electron环境使用Webview标签。回退至使用iframe。'));
      }
      return new IframePlainWebview();
    }

  }

}
