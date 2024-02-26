import { Injector } from '@opensumi/di';

import { ICtxMenuRenderer } from '../../../menu/next';
import { BrowserCtxMenuRenderer } from '../../../menu/next/renderer/ctxmenu/browser';

export function injectBrowserInnerProviders(injector: Injector) {
  injector.addProviders({
    token: ICtxMenuRenderer,
    useClass: BrowserCtxMenuRenderer,
  });
}
