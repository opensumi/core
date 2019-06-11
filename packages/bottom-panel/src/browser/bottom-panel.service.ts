import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { CommandService } from '@ali/ide-core-common';

@Injectable()
export class BottomPanelService extends Disposable {

  @observable
  public panels: BottomPanelService.Panel[] = [];

  @Autowired(CommandService)
  private commandService!: CommandService;
  constructor() {
      super();
  }
  hidePanel = () => {
    this.commandService.executeCommand('main-layout.bottom-panel.hide');
  }
  showPanel = () => {
    this.commandService.executeCommand('main-layout.bottom-panel.show');
  }

  append = (options: BottomPanelService.IOptions) => {
    this.panels.push({ title: options.title, component: options.component});
  }

}
// tslint:disable-next-line: no-namespace
export namespace BottomPanelService {

  export interface Panel {
    title: string;
    component: React.FunctionComponent;
  }

  export interface IOptions {
    title: string;
    component: React.FunctionComponent;
  }
}
