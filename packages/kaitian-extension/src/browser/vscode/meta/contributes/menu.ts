// import { VscodeContributionPoint, Contributes } from './common';
import { VSCodeContributePoint, Contributes } from '../../../../common';
import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, formatLocalize, MenuModelRegistry } from '@ali/ide-core-browser';
// import { VSCodeExtensionService } from '../types';
import { VIEW_ITEM_CONTEXT_MENU, VIEW_ITEM_INLINE_MNUE } from '../../api/main.thread.treeview';
import { TabBarToolbarRegistry } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';

export interface MenuActionFormat {
  when: string;
  command: string;
  alt: string;
  group: string;
}

export interface MenusSchema {
  [MenuPosition: string]: MenuActionFormat[];
}
export function parseMenuPath(value: string): string[] | undefined {
  switch (value) {
    case 'commandPalette': return [];
    case 'touchBar': return [];

    case 'editor/title': return ['editor', 'title'];
    case 'editor/context': return [];
    case 'editor/title/context': return ['editor'];

    case 'explorer/context': return ['filetree-context-menu'];

    case 'debug/callstack/context': return [];
    case 'debug/toolbar': return [];
    case 'debug/toolBar': return [];
    case 'menuBar/file': return [];
    case 'scm/title': return [];
    case 'scm/sourceControl': return [];
    case 'scm/resourceGroup/context': return [];
    case 'scm/resourceState/context': return ['scm/resourceState/context'];
    case 'scm/change/title': return [];
    case 'statusBar/windowIndicator': return [];

    case 'view/title': return [];
  }

  return undefined;
}
export function isProposedAPI(menuPosition: string): boolean {
  switch (menuPosition) {
    case 'statusBar/windowIndicator':
    case 'menuBar/file':
      return true;
  }
  return false;
}

export function isValidMenuItems(menu: MenuActionFormat[], collector: Console): boolean {
  if (!Array.isArray(menu)) {
    collector.error(formatLocalize('requirearray'));
    return false;
  }

  for (const item of menu) {
    if (typeof item.command !== 'string') {
      collector.error(formatLocalize('requirestring', 'command'));
      return false;
    }
    if (item.alt && typeof item.alt !== 'string') {
      collector.error(formatLocalize('optstring', 'alt'));
      return false;
    }
    if (item.when && typeof item.when !== 'string') {
      collector.error(formatLocalize('optstring', 'when'));
      return false;
    }
    if (item.group && typeof item.group !== 'string') {
      collector.error(formatLocalize('optstring', 'group'));
      return false;
    }
  }

  return true;
}

@Injectable()
@Contributes('menus')
export class MenusContributionPoint extends VSCodeContributePoint<MenusSchema> {

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(MenuModelRegistry)
  menuRegistry: MenuModelRegistry;

  @Autowired()
  toolBarRegistry: TabBarToolbarRegistry;

  protected createSyntheticCommandId(menu: MenuActionFormat, prefix: string ): string {
    const command = menu.command;
    let id = prefix + command;
    let index = 0;
    while (this.commandRegistry.getCommand(id)) {
      id = prefix + command + ':' + index;
      index++;
    }
    return id;
  }

  contribute() {

    const collector = console;

    for (const menuPosition of Object.keys(this.json)) {
      if (menuPosition === 'view/item/context') {
        for (const menu of this.json[menuPosition]) {
          const inline = menu.group && /^inline/.test(menu.group) || false;
          const menuPath = inline ? VIEW_ITEM_INLINE_MNUE : VIEW_ITEM_CONTEXT_MENU;
          const command = this.commandRegistry.getCommand(menu.command);
          const alt = menu.alt && this.commandRegistry.getCommand(menu.alt);

          if (!command) {
            collector.error(formatLocalize('missing.command', menu.command));
            continue;
          }
          if (menu.alt && !alt) {
            collector.warn(formatLocalize('missing.altCommand', menu.alt));
          }
          this.menuRegistry.registerMenuAction(menuPath, {
            commandId: command.id,
            // TODO: 设置ContextKeys
            // when: menu.when,
          });
        }
      } else if (menuPosition === 'view/title' || menuPosition === 'scm/title') {
        for (const item of this.json[menuPosition]) {
          this.toolBarRegistry.registerItem({
            id: this.createSyntheticCommandId(item, 'view.title.'),
            command: item.command,
            // TODO 图标服务（command注册的图标为 {dark: '', light: ''})
            iconClass: this.commandRegistry.getCommand(item.command)!.iconClass ? 'fa fa-eye' : 'fa fa-calendar-minus-o',
            when: item.when,
            group: item.group,
          });
        }
      } else {
        const menuActions = this.json[menuPosition];
        if (!isValidMenuItems(menuActions, console)) {
          return;
        }

        const menuPath = parseMenuPath(menuPosition);
        if (!menuPath) {
          collector.warn(formatLocalize('menuId.invalid', menuPosition));
          return;
        }

        if (isProposedAPI(menuPosition)/* && !extension.description.enableProposedApi*/) {
          collector.error(formatLocalize('proposedAPI.invalid', menuPosition));
          return;
        }

        for (const item of menuActions) {
          const command = this.commandRegistry.getCommand(item.command);
          const alt = item.alt && this.commandRegistry.getCommand(item.alt);

          if (!command) {
            collector.error(formatLocalize('missing.command', item.command));
            continue;
          }
          if (item.alt && !alt) {
            collector.warn(formatLocalize('missing.altCommand', item.alt));
          }
          if (item.command === item.alt) {
            collector.info(formatLocalize('dupe.command'));
          }

          let group: string | undefined;
          let order: number | undefined;
          if (item.group) {
            const idx = item.group.lastIndexOf('@');
            if (idx > 0) {
              group = item.group.substr(0, idx);
              order = Number(item.group.substr(idx + 1)) || undefined;
            } else {
              group = item.group;
            }
          }

          this.menuRegistry.registerMenuAction(menuPath, {
            commandId: command.id,
            label: alt ? alt.toString() : '',
            when: item.when,
          });
        }
      }
    }
  }
}
