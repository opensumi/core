import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { CommandService } from '@ali/ide-core-common';

@Injectable()
export class ActivatorBarService extends Disposable {

  @Autowired(CommandService)
  private commandService!: CommandService;
  constructor() {
      super();
  }
  hidePanel = () => {
    this.commandService.executeCommand('main-layout.panel.hide', SlotLocation.activatorPanel);
  }
  showPanel = () => {
    this.commandService.executeCommand('main-layout.panel.show', SlotLocation.activatorPanel);
  }
}
