import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';
import { SlotLocation } from '@ali/ide-main-layout';
import { CommandService } from '@ali/ide-core-common';
import { EDITOR_BROSWER_COMMANDS } from '@ali/ide-editor';

@Injectable()
export class MenuBarService extends Disposable {

  @Autowired(CommandService)
  private commandService!: CommandService;
  constructor() {
      super();
  }
  hidePanel = () => {
    this.commandService.executeCommand('main-layout.subsidiary-panel.hide');
  }
  showPanel = () => {
    this.commandService.executeCommand('main-layout.subsidiary-panel.show');
  }
  saveCurrent = () => {
    this.commandService.executeCommand(EDITOR_BROSWER_COMMANDS.saveCurrent);
  }
}
