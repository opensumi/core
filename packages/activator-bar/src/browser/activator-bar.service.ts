import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';

import { CommandService } from '@ali/ide-core-common';

@Injectable()
export class ActivatorBarService extends Disposable {

  @observable
  public panels: ActivatorBarService.Panel[] = [];

  @Autowired(CommandService)
  private commandService!: CommandService;
  constructor() {
      super();
  }
  hidePanel = () => {
    this.commandService.executeCommand('main-layout.activator-panel.hide');
  }
  showPanel = () => {
    this.commandService.executeCommand('main-layout.activator-panel.show');
  }

  append = (options: ActivatorBarService.IOptions) => {
    this.panels.push({ iconClass: options.iconClass, component: options.component});
  }

}
// tslint:disable-next-line: no-namespace
export namespace ActivatorBarService {

  export interface Panel {
    iconClass: string;
    component: React.FunctionComponent;
  }

  export interface IOptions {
    iconClass: string;
    component: React.FunctionComponent;
  }
}
