import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';

import { CommandService } from '@ali/ide-core-common';

@Injectable()
export class ActivatorBarService extends Disposable {

  @observable
  public leftPanels: ActivatorBarService.Panel[] = [];

  @observable
  public rightPanels: ActivatorBarService.Panel[] = [];

  @Autowired(CommandService)
  private commandService!: CommandService;
  constructor() {
      super();
  }
  hidePanel = (side) => {
    this.commandService.executeCommand(`main-layout.${side}-panel.hide`);
  }
  showPanel = (side) => {
    this.commandService.executeCommand(`main-layout.${side}-panel.show`);
  }

  append = (options: ActivatorBarService.IOptions) => {
    if (options.side === 'right') {
      this.rightPanels.push({ iconClass: options.iconClass, component: options.component});
    } else if (options.side === 'left') {
      this.leftPanels.push({ iconClass: options.iconClass, component: options.component});
    } else {
      console.warn('暂不支持的位置！' + options.side);
    }
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
    side: Side;
  }
}

export type Side = 'left' | 'right';
