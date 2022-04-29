import { observable } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { debounce, Emitter, Event } from '@opensumi/ide-core-common';

import { ITerminalSearchService, ITerminalGroupViewService, ITerminalController, ITerminalClient } from '../common';

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

  get client(): ITerminalClient | undefined {
    return this.controller.findClientFromWidgetId(this.terminalView.currentWidget.id);
  }

  open() {
    this.show = true;
    this._onOpen.fire();
  }

  close() {
    this.client?.closeSearch();
    this.show = false;
  }

  clear() {
    this.client?.closeSearch();
    this.input = '';
  }

  @debounce(150)
  search() {
    this.client?.findNext(this.input);
  }
}
