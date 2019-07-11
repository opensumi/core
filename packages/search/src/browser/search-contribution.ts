import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { Emitter } from '@ali/ide-core-common';
@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution)
export class SearchContribution implements CommandContribution, KeybindingContribution, MenuContribution {

  @Autowired()
  logger: Logger;

  protected resultEmitter: Emitter<number> = new Emitter();

  registerCommands(commands: CommandRegistry): void {}

  registerMenus(menus: MenuModelRegistry): void {}

  registerKeybindings(keybindings: KeybindingRegistry): void {}

  onSearchResult(data, id) {
    this.resultEmitter.fire(data);
  }

  get onResult() {
    return this.resultEmitter.event;
  }

}
