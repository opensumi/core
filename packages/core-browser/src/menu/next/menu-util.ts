import { MenuItemNode, SubmenuItemNode, SeparatorMenuItemNode } from './menu-service';
import { MenuNode } from './base';

export const isPrimaryGroup = (group: string) => group === 'navigation';
export const isInlineGroup = (group: string) => /^inline/.test(group);

export type TupleMenuNodeResult = [ MenuNode[], MenuNode[] ];

/**
 * 将 menuItems 按照 splitMarker 分成两个 group
 * todo: 支持返回结果合并成一个 group
 */
export function splitMenuItems(
  groups: ReadonlyArray<[string, ReadonlyArray<MenuItemNode | SubmenuItemNode>]>,
  splitMarker: 'navigation' | 'inline' = 'navigation',
): TupleMenuNodeResult {
  const result: TupleMenuNodeResult = [ [], [] ];
  for (const tuple of groups) {
    const [ groupIdentity, menuNodes ] = tuple;

    const splitFn = splitMarker === 'inline' ? isInlineGroup : isPrimaryGroup;

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
