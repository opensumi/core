import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { menus } from '@opensumi/ide-core-browser/lib/extensions/schema/menu';
import { IMenuRegistry, ISubmenuItem } from '@opensumi/ide-core-browser/lib/menu/next';
import { formatLocalize, isUndefined } from '@opensumi/ide-core-common';
import { IIconService, IconType } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { IContributedSubmenu } from '../../../common/sumi/extension';
import { AbstractExtInstanceManagementService } from '../../types';
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
@LifeCycle(LifeCyclePhase.Starting)
export class SubmenusContributionPoint extends VSCodeContributePoint<KtSubmenusSchema> {
  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  @Autowired(IIconService)
  protected readonly iconService: IIconService;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  static schema = menus.subMenusSchema;

  contribute() {
    const collector = console;

    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }

      for (const menuPosition of Object.keys(contributes)) {
        const menuActions = contributes[menuPosition];
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
              label: item.title && this.getLocalizeFromNlsJSON(item.title, extensionId),
              iconClass: this.iconService.fromIcon(extension.path, item.icon, IconType.Background),
              when: item.when,
              group,
              order,
              nativeRole: item.nativeRole,
            } as ISubmenuItem),
          );
        }
      }
    }

    // menu registration
  }
}
