import { makeObservable, observable } from 'mobx';

import { Autowired, Injectable } from '@opensumi/di';
import { Emitter, Event, debounce } from '@opensumi/ide-core-common';

import { ITerminalClient, ITerminalController, ITerminalGroupViewService, ITerminalSearchService } from '../common';

@Injectable()
export class TerminalSearchService implements ITerminalSearchService {
  @observable
  show: boolean;

  @observable
  input = '';

  @Autowired(ITerminalController)
  controller: ITerminalController;

  @Autowired(ITerminalGroupViewService)
  terminalView: ITerminalGroupViewService;

  protected _onOpen = new Emitter<void>();

  onOpen: Event<void> = this._onOpen.event;

  constructor() {
    makeObservable(this);
  }

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
