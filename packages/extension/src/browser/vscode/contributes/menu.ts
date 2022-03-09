import { Injectable, Autowired } from '@opensumi/di';
import {
  CommandRegistry,
  CommandService,
  ILogger,
  formatLocalize,
  IContextKeyService,
  isUndefined,
  URI,
  localize,
} from '@opensumi/ide-core-browser';
import { ToolbarRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { IMenuRegistry, MenuId, IMenuItem, ISubmenuItem } from '@opensumi/ide-core-browser/lib/menu/next';
import { IEditorGroup } from '@opensumi/ide-editor';
import { IEditorActionRegistry } from '@opensumi/ide-editor/lib/browser';
import { ThemeType } from '@opensumi/ide-theme';
import { IconType, IIconService } from '@opensumi/ide-theme/lib/common/theme.service';

import { VSCodeContributePoint, Contributes } from '../../../common';

// 对插件侧 contributes 的 menu interface
export interface MenuActionFormat extends IMenuItem {
  command: string;
  when?: string;
  alt?: string;
}

// 对插件侧 contributes 的 submenu interface
export type SubmenuActionFormat = ISubmenuItem;

function isMenuActionFormat(item: MenuActionFormat | SubmenuActionFormat): item is MenuActionFormat {
  return typeof (item as MenuActionFormat).command === 'string';
}

export interface MenusSchema {
  [MenuPosition: string]: Array<MenuActionFormat | SubmenuActionFormat>;
}

export type SubmenusSchema = Array<{
  id: string;
  label: string;
  icon?: { [index in ThemeType]: string } | string;
}>;

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

export function isValidMenuItem(item: MenuActionFormat, collector: Console): boolean {
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

  return true;
}

function isValidSubmenuItem(item: SubmenuActionFormat, collector: Console): boolean {
  if (typeof item.submenu !== 'string') {
    collector.error(
      formatLocalize('requirestring', 'property `{0}` is mandatory and must be of type `string`', 'submenu'),
    );
    return false;
  }
  if (item.when && typeof item.when !== 'string') {
    collector.error(formatLocalize('optstring', 'property `{0}` can be omitted or must be of type `string`', 'when'));
    return false;
  }
  if (item.group && typeof item.group !== 'string') {
    collector.error(formatLocalize('optstring', 'property `{0}` can be omitted or must be of type `string`', 'group'));
    return false;
  }

  return true;
}

function isValidItems(items: Array<MenuActionFormat | SubmenuActionFormat>, collector: Console): boolean {
  if (!Array.isArray(items)) {
    collector.error(formatLocalize('requirearray', 'submenu items must be an array'));
    return false;
  }

  for (const item of items) {
    if (isMenuActionFormat(item)) {
      if (!isValidMenuItem(item, collector)) {
        return false;
      }
    } else {
      if (!isValidSubmenuItem(item, collector)) {
        return false;
      }
    }
  }

  return true;
}

// vscode contributes#submenus 时, 用来做 submenu item 的 i18n 字符替换
const _submenuDescRegistry = new Map<string /* submenu id */, SubmenusSchema>();

@Injectable()
@Contributes('submenus')
export class SubmenusContributionPoint extends VSCodeContributePoint<SubmenusSchema> {
  schema = {};

  contribute() {
    _submenuDescRegistry.set(this.extension.id, this.json);
  }
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

  @Autowired(IIconService)
  private readonly iconService: IIconService;

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

  static VAR_REGEXP = /\$\(.*?\)/g;

  private toIconClass(iconContrib: { [index in ThemeType]: string } | string): string | undefined {
    if (typeof iconContrib === 'object') {
      const iconClass = this.iconService.fromIcon(this.extension.path, iconContrib, IconType.Background);
      return iconClass;
    }
    const parsedName = MenusContributionPoint.VAR_REGEXP.exec(iconContrib);
    if (parsedName && parsedName[1]) {
      return this.iconService.fromString(parsedName[1]);
    }
    return this.iconService.fromString(iconContrib);
  }

  contribute() {
    const collector = console;

    // menu registration
    for (const menuPosition of Object.keys(this.json)) {
      const menuActions = this.json[menuPosition];
      if (!isValidItems(menuActions, console)) {
        return;
      }
      const menuId = parseMenuId(menuPosition);
      if (isUndefined(menuId)) {
        collector.warn(formatLocalize('menuId.invalid', '`{0}` is not a valid menu identifier', menuPosition));
        return;
      }

      for (const item of menuActions) {
        if (isMenuActionFormat(item)) {
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
          if ((menuId as MenuId) === MenuId.EditorTitleContext) {
            argsTransformer = ({ uri, group }: { uri: URI; group: IEditorGroup }) => [uri.codeUri];
          } else if ((menuId as MenuId) === MenuId.EditorTitle) {
            argsTransformer = (uri: URI, group: IEditorGroup, editorUri?: URI) => [editorUri?.codeUri || uri.codeUri];
          }

          this.addDispose(
            this.menuRegistry.registerMenuItem(menuId, {
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
            } as IMenuItem),
          );
        } else {
          const submenuRegistry = _submenuDescRegistry.get(this.extension.id);
          if (!submenuRegistry) {
            collector.error(localize('missing.submenu.section', 'Need a submenu contributes firstly', item.submenu));
            continue;
          }
          const submenuDesc = submenuRegistry.find((n) => n.id === item.submenu);

          if (!submenuDesc) {
            collector.error(
              localize(
                'missing.submenu',
                "Menu item references a submenu `{0}` which is not defined in the 'submenus' section.",
                item.submenu,
              ),
            );
            continue;
          }

          const [group, order] = parseMenuGroup(item.group);

          this.addDispose(
            this.menuRegistry.registerMenuItem(menuId, {
              submenu: item.submenu,
              label: this.getLocalizeFromNlsJSON(submenuDesc.label),
              when: item.when,
              group,
              order,
              iconClass: submenuDesc.icon && this.toIconClass(submenuDesc.icon),
            } as ISubmenuItem),
          );
        }
      }
    }
  }
}
