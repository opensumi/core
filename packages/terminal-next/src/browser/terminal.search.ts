import { observable } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { Emitter, Event } from '@opensumi/ide-core-common';

import { ITerminalSearchService, ITerminalGroupViewService, ITerminalController } from '../common';

@Injectable()
export class TerminalSearchService implements ITerminalSearchService {
  @observable
  show: boolean;

  @observable
  input: string;

  @Autowired(ITerminalController)
  controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  terminalView: ITerminalGroupViewService;

  protected _onOpen = new Emitter<void>();

  onOpen: Event<void> = this._onOpen.event;

  open() {
    this.show = true;
    this._onOpen.fire();
  }

  close() {
    this.show = false;
  }

  clear() {
    this.input = '';
  }

  search() {
    const client = this.controller.findClientFromWidgetId(this.terminalView.currentWidget.id);

    if (!client) {
      throw new Error('client not found');
    }

    client.findNext(this.input);
  }
}
