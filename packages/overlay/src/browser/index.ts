import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';

import { IDialogService, IMessageService } from '../common';

import { BrowserCtxMenuService } from './ctx-menu/ctx-menu.service';
import { DialogService } from './dialog.service';
import { Overlay } from './index.view';
import { MessageService } from './message.service';


@Injectable()
export class OverlayModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IDialogService,
      useClass: DialogService,
    },
    {
      token: IMessageService,
      useClass: MessageService,
    },
    {
      token: IBrowserCtxMenu,
      useClass: BrowserCtxMenuService,
    },
  ];

  isOverlay = true;
  component = Overlay;
}
