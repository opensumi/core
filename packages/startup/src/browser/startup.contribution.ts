import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, CommandService, IEventBus, formatLocalize, getLanguageAlias } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, COMMON_MENUS } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry } from '@ali/ide-core-common/lib/menu';
import { InitedEvent } from '@ali/ide-main-layout';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, LayoutContribution)
export class StartupContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution, LayoutContribution {

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(CommandService)
  private commandService!: CommandService;

  @Autowired(StatusBar)
  statusBar: StatusBar;

  @Autowired()
  logger: Logger;

  onStart() {
    this.eventBus.on(InitedEvent, () => {
      // this.commandService.executeCommand('main-layout.subsidiary-panel.hide');

      const lang = getLanguageAlias();
      if (lang) {
        this.statusBar.addElement('lang_set', {
          text: formatLocalize('menu-bar.view.outward.localize.toogle.message', lang),
          alignment: StatusBarAlignment.LEFT,
        });
      }
    });
  }

  registerComponent(registry: ComponentRegistry) {
  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerMenus(menus: MenuModelRegistry): void {
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }
}
