import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
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

  open() {
    this.show = true;
  }

  close() {
    this.show = false;
  }

  clear() {
    this.input = '';
  }

  search() {
    const client = this.controller
      .findClientFromWidgetId(this.terminalView.currentWidget.id);

    if (!client) {
      throw new Error('client not found');
    }

    client.findNext(this.input);
  }
}
