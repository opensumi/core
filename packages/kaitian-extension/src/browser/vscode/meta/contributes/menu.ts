import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, formatLocalize, MenuModelRegistry, MenuAction } from '@ali/ide-core-browser';
import { TabBarToolbarRegistry } from '@ali/ide-activity-panel/lib/browser/tab-bar-toolbar';
import { SCMMenuId } from '@ali/ide-scm';

import { VSCodeContributePoint, Contributes } from '../../../../common';
import { VIEW_ITEM_CONTEXT_MENU, VIEW_ITEM_INLINE_MNUE } from '../../api/main.thread.treeview';

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
    case 'scm/resourceGroup/context': return [SCMMenuId.SCM_RESOURCE_GROUP_CTX];
    case 'scm/resourceState/context': return [SCMMenuId.SCM_RESOURCE_STATE_CTX];
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

  protected createSyntheticCommandId(menu: MenuActionFormat, prefix: string): string {
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
          const command = this.commandRegistry.getCommand(item.command);
          this.toolBarRegistry.registerItem({
            id: this.createSyntheticCommandId(item, 'title.'),
            command: item.command,
            iconClass: command!.iconClass,
            when: [menuPosition === 'scm/title' ? 'view == scm' : '', item.when].join(' && '),
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
          const { when } = item;
          const [group = '', order] = (item.group || '').split('@');
          const action: MenuAction = { commandId: item.command, order, when };
          const inline = /^inline/.test(group);
          // todo: 先跳过 inline 的 menu @taian.lta
          if (!inline) {
            const currentMenuPath = [...menuPath, group];
            this.menuRegistry.registerMenuAction(currentMenuPath, action);
          }
        }
      }
    }
  }
}
