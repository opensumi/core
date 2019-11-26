import { MenuItemNode, SubmenuItemNode, SeparatorMenuItemNode, IMenu, IMenuNodeOptions } from './menu-service';
import { MenuNode } from './base';

export const isPrimaryGroup = (group: string) => group === 'navigation';
export const isInlineGroup = (group: string) => /^inline/.test(group);

export type TupleMenuNodeResult = [ MenuNode[], MenuNode[] ];

/**
 * 将 menuItems 按照 separator 分成两个 group
 * todo: 支持返回结果合并成一个 group
 */
export function splitMenuItems(
  groups: Array<[string, Array<MenuItemNode | SubmenuItemNode>]>,
  separator: MenuSeparator = 'navigation',
): TupleMenuNodeResult {
  const result: TupleMenuNodeResult = [ [], [] ];
  for (const tuple of groups) {
    const [ groupIdentity, menuNodes ] = tuple;

    const splitFn = separator === 'inline' ? isInlineGroup : isPrimaryGroup;

    if (splitFn(groupIdentity)) {
      result[0].push(...menuNodes);
    } else {
      if (result[1].length > 0) {
        result[1].push(new SeparatorMenuItemNode());
      }

      result[1].push(...menuNodes);
    }
  }
  return result;
}

export type MenuSeparator = 'navigation' | 'inline';

interface MenuGeneratePayload {
  menus: IMenu;
  separator?: MenuSeparator;
  options?: IMenuNodeOptions;
  withAlt?: boolean;
}

export function generateMergedCtxMenu(payload: MenuGeneratePayload) {
  const result = generateCtxMenu(payload);
  return [...result[0], ...result[1]];
}

export function generateCtxMenu(payload: MenuGeneratePayload) {
  const { menus, options, separator = 'navigation' } = payload;
  const menuNodes = menus.getMenuNodes(options);
  const menuItems = splitMenuItems(menuNodes, separator);
  return menuItems;
}

export function generateMergedInlineActions(payload: MenuGeneratePayload) {
  const result = generateInlineActions(payload);
  return [...result[0], ...result[1]];
}

export function generateInlineActions(payload: Omit<MenuGeneratePayload, 'withAlt'>) {
  const { menus, options, separator } = payload;
  const menuNodes = menus.getMenuNodes(options);
  const menuItems = splitMenuItems(menuNodes, separator);
  return menuItems;
}
