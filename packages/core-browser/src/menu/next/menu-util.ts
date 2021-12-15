import {
  MenuItemNode,
  SubmenuItemNode,
  SeparatorMenuItemNode,
  TupleMenuNodeResult,
  IMenu,
  IMenuSeparator,
  IMenuConfig,
  ComponentMenuItemNode,
} from './menu.interface';

export const isPrimaryGroup = (group: string) => group === 'navigation';
export const isInlineGroup = (group: string) => /^inline/.test(group);

/**
 * 将 menuItems 按照 separator 分成两个 group
 * todo: 支持返回结果合并成一个 group
 */
export function splitMenuItems(
  groups: Array<[string, Array<MenuItemNode | SubmenuItemNode | ComponentMenuItemNode>]>,
  separator: IMenuSeparator = 'navigation',
): TupleMenuNodeResult {
  const result: TupleMenuNodeResult = [[], []];
  for (const tuple of groups) {
    const [groupIdentity, menuNodes] = tuple;

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

interface IExtendMenuConfig extends IMenuConfig {
  menus: IMenu;
}

export function mergeTupleMenuNodeResult(payload: TupleMenuNodeResult) {
  const [primary, secondary] = payload;
  const result = [...primary];
  if (result.length > 0 && secondary.length > 0) {
    result.push(new SeparatorMenuItemNode());
  }

  return result.concat(secondary);
}

export function generateMergedCtxMenu(payload: IExtendMenuConfig) {
  return mergeTupleMenuNodeResult(generateCtxMenu(payload));
}

export function generateCtxMenu(payload: IExtendMenuConfig) {
  const { menus, separator = 'navigation', ...options } = payload;
  const menuNodes = menus.getMenuNodes(options);
  const menuItems = splitMenuItems(menuNodes, separator);
  return menuItems;
}

export function generateMergedInlineActions(payload: IExtendMenuConfig) {
  const result = generateInlineActions(payload);
  return [...result[0], ...result[1]];
}

export function generateInlineActions(payload: Omit<IExtendMenuConfig, 'withAlt'>) {
  const { menus, separator, ...options } = payload;
  const menuNodes = menus.getMenuNodes(options);
  const menuItems = splitMenuItems(menuNodes, separator);
  return menuItems;
}
