import { Provider, Injectable } from '@opensumi/common-di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { Overlay } from './index.view';
import { IDialogService, IMessageService } from '../common';
import { DialogService } from './dialog.service';
import { MessageService } from './message.service';
import { BrowserCtxMenuService } from './ctx-menu/ctx-menu.service';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';

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
