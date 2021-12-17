import { Injectable, Autowired } from '@opensumi/di';
import { IMenuRegistry, ISubmenuItem } from '@opensumi/ide-core-browser/lib/menu/next';
import { localize, formatLocalize, isUndefined } from '@opensumi/ide-core-common';
import { IIconService, IconType } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes } from '../../../common';
import { IContributedSubmenu } from '../../../common/sumi/extension';
import { parseMenuId, parseMenuGroup } from '../../vscode/contributes/menu';

export interface KtSubmenusSchema {
  [MenuPosition: string]: IContributedSubmenu[];
}

export function isValidSubmenu(submenu: IContributedSubmenu[], collector: Console): boolean {
  if (!Array.isArray(submenu)) {
    collector.error(formatLocalize('requirearray'));
    return false;
  }

  for (const item of submenu) {
    if (typeof item.id !== 'string') {
      collector.error(formatLocalize('requirestring', 'id'));
      return false;
    }
    if (item.title && typeof item.title !== 'string') {
      collector.error(formatLocalize('optstring', 'title'));
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
@Contributes('submenus')
export class SubmenusContributionPoint extends VSCodeContributePoint<KtSubmenusSchema> {
  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  schema = {
    description: localize('kaitianContributes.submenu', 'Contributes extension defined submenu'),
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: localize('kaitianContributes.submenu.id', 'The identifier of submenu item, used as menu-id'),
        },
        title: {
          type: 'string',
          description: localize('kaitianContributes.submenu.title', 'The title of submenu item'),
        },
        group: {
          type: 'string',
          description: localize('kaitianContributes.submenu.group', 'The order of submenu item'),
        },
        when: {
          type: 'string',
          description: localize('kaitianContributes.submenu.when', 'The when expression string of submenu item'),
        },
      },
    },
  };

  contribute() {
    const collector = console;

    // menu registration
    for (const menuPosition of Object.keys(this.json)) {
      const menuActions = this.json[menuPosition];
      if (!isValidSubmenu(menuActions, console)) {
        return;
      }

      const menuId = parseMenuId(menuPosition);
      if (isUndefined(menuId)) {
        collector.warn(formatLocalize('menuId.invalid', '`{0}` is not a valid submenu identifier', menuPosition));
        return;
      }

      for (const item of menuActions) {
        const [group, order] = parseMenuGroup(item.group);

        this.addDispose(
          this.menuRegistry.registerMenuItem(menuId, {
            submenu: item.id,
            label: item.title && this.getLocalizeFromNlsJSON(item.title),
            iconClass: this.iconService.fromIcon(this.extension.path, item.icon, IconType.Background),
            when: item.when,
            group,
            order,
            nativeRole: item.nativeRole,
          } as ISubmenuItem),
        );
      }
    }
  }
}
