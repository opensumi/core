import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { IBrowserCtxMenu } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';

import { IDialogService, IMessageService } from '../common';

import { BrowserCtxMenuService } from './ctx-menu/ctx-menu.service';
import { DialogContextKey } from './dialog.contextkey';
import { DialogContribution } from './dialog.contribution';
import { DialogService } from './dialog.service';
import { Overlay } from './index.view';
import { MessageService } from './message.service';

@Injectable()
export class OverlayModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: DialogContextKey,
      useClass: DialogContextKey,
    },
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
    DialogContribution,
  ];

  isOverlay = true;
  component = Overlay;
}
