import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { Overlay } from './index.view';
import { IDialogService, IMessageService, IWindowDialogService } from '../common';
import { DialogService } from './dialog.service';
import { MessageService } from './message.service';
import { BrowserCtxMenuService } from './ctx-menu/ctx-menu.service';
import { IBrowserCtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { WindowDialogServiceImpl } from './window-dialog.service';

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
      token: IBrowserCtxMenuRenderer,
      useClass: BrowserCtxMenuService,
    },
    {
      token: IWindowDialogService,
      useClass: WindowDialogServiceImpl,
    },
  ];

  component = Overlay;
}
