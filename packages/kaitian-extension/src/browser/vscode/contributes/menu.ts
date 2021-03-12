import { Injectable, Autowired } from '@ali/common-di';
import { CommandRegistry, CommandService, ILogger, formatLocalize, IContextKeyService, isUndefined, URI } from '@ali/ide-core-browser';
import { ToolbarRegistry } from '@ali/ide-core-browser/lib/layout';
import { IMenuRegistry, MenuId, IMenuItem } from '@ali/ide-core-browser/lib/menu/next';
import { IEditorActionRegistry } from '@ali/ide-editor/lib/browser';
import { IEditorGroup } from '@ali/ide-editor';

import { VSCodeContributePoint, Contributes } from '../../../common';

export interface MenuActionFormat extends IMenuItem {
  command: string;
  when?: string;
  alt?: string;
}

export interface MenusSchema {
  [MenuPosition: string]: MenuActionFormat[];
}

export function parseMenuId(value: string): MenuId | string {
  switch (value) {
    // 以下仅保留对 vscode 部分 menuId 的兼容
    case 'touchBar':
      return MenuId.TouchBarContext;
    case 'debug/toolBar':
      return MenuId.DebugToolBar;
    case 'statusBar/windowIndicator':
      return MenuId.StatusBarWindowIndicatorMenu;
    case 'menuBar/file':
      return MenuId.MenubarFileMenu;
    default:
      return value;
  }
}

export function parseMenuGroup(groupStr?: string) {
  let group: string | undefined;
  let order: number | undefined;
  if (groupStr) {
    const idx = groupStr.lastIndexOf('@');
    if (idx > 0) {
      group = groupStr.substr(0, idx);
      order = Number(groupStr.substr(idx + 1)) || undefined;
    } else {
      group = groupStr;
    }
  }
  return [group, order];
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

  @Autowired(IMenuRegistry)
  menuRegistry: IMenuRegistry;

  @Autowired()
  toolBarRegistry: ToolbarRegistry;

  @Autowired(IEditorActionRegistry)
  editorActionRegistry: IEditorActionRegistry;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

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

    // menu registration
    for (const menuPosition of Object.keys(this.json)) {
      const menuActions = this.json[menuPosition];
      if (!isValidMenuItems(menuActions, console)) {
        return;
      }
      const menuId = parseMenuId(menuPosition);
      if (isUndefined(menuId)) {
        collector.warn(formatLocalize('menuId.invalid', '`{0}` is not a valid menu identifier', menuPosition));
        return;
      }

      for (const item of menuActions) {
        const command = this.commandRegistry.getRawCommand(item.command);
        // alt 逻辑先不处理
        const alt = item.alt && this.commandRegistry.getRawCommand(item.alt);

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

        const [group, order] = parseMenuGroup(item.group);
        let argsTransformer: ((...args: any[]) => any[]) | undefined;
        if (menuId as MenuId === MenuId.EditorTitleContext) {
          argsTransformer = ({ uri, group }: {uri: URI, group: IEditorGroup}) => {
            return [uri.codeUri];
          };
        } else if (menuId as MenuId === MenuId.EditorTitle) {
          argsTransformer = (uri?: URI, group?: IEditorGroup, editorUri?: URI) => {
            return [editorUri?.codeUri || uri?.codeUri];
          };
        }

        this.addDispose(this.menuRegistry.registerMenuItem(
          menuId,
          {
            command: item.command,
            alt,
            group,
            order,
            when: item.when,
            // 以下为 kaitian 扩展部分
            argsTransformer,
            type: item.type,
            toggledWhen: item.toggledWhen,
            enabledWhen: item.enabledWhen,
          } as IMenuItem,
        ));
      }
    }
  }
}
