import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { CommandService } from '@ali/ide-core-common';
import { EDITOR_BROWSER_COMMANDS } from '@ali/ide-editor';

@Injectable()
export class MenuBarService extends Disposable {

  @Autowired(CommandService)
  private commandService!: CommandService;
  constructor() {
      super();
  }
  hidePanel = (slotName: SlotLocation) => {
    this.commandService.executeCommand('main-layout.panel.hide', SlotLocation.rightPanel);
  }
  showPanel = (slotName: SlotLocation) => {
    this.commandService.executeCommand('main-layout.panel.show', SlotLocation.rightPanel);
  }
  saveCurrent = () => {
    this.commandService.executeCommand(EDITOR_BROWSER_COMMANDS.saveCurrent);
  }
}
