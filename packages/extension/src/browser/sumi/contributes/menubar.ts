import { Injectable, Autowired } from '@opensumi/di';
import { IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';
import { localize } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes } from '../../../common';
import { IContributeMenubarItem } from '../../../common/sumi/extension';

export type KtMenubarsSchema = IContributeMenubarItem[];

@Injectable()
@Contributes('menubars')
export class MenubarsContributionPoint extends VSCodeContributePoint<KtMenubarsSchema> {
  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  schema = {
    description: localize('extensionContributes.menubars', 'Contributes extension defined menubars'),
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: localize('extensionContributes.menubars.id', 'The identifier of menubar item, used as menu-id'),
        },
        title: {
          type: 'string',
          description: localize('extensionContributes.menubars.title', 'The title of menubar item'),
        },
        order: {
          type: 'number',
          description: localize('extensionContributes.menubars.order', 'The order of  menubar item'),
        },
        nativeRole: {
          type: 'string',
          description: localize('extensionContributes.menubars.order', 'The nativeRole of  menubar item'),
        },
      },
    },
  };

  contribute() {
    for (const menubarItem of this.json) {
      this.addDispose(this.menuRegistry.registerMenubarItem(
        menubarItem.id,
        {
          label: this.getLocalizeFromNlsJSON(menubarItem.title),
          order: menubarItem.order,
          nativeRole: menubarItem.nativeRole,
        },
      ));
    }
  }
}
