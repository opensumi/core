import { Injectable, Autowired } from '@ali/common-di';
import { IMenuRegistry } from '@ali/ide-core-browser/lib/menu/next';
import { IKaitianMenuExtendInfo } from '@ali/ide-core-common';

import { VSCodeContributePoint, Contributes } from '../../../common';
import { IContributeMenubarItem } from '../../../common/kaitian/extension';

export type KtMenubarsSchema = IContributeMenubarItem[];

@Injectable()
@Contributes('menu-extend')
export class KtMenuExtendContributionPoint extends VSCodeContributePoint<KtMenubarsSchema> {
  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  contribute() {
    for (const menuPosition of Object.keys(this.json)) {
      const menuActions = this.json[menuPosition] as Array<IKaitianMenuExtendInfo>;

      this.addDispose(
        this.menuRegistry.registerMenuExtendInfo(menuPosition, menuActions.map(this.handleExtendInfo.bind(this))),
      );
    }
  }

  handleExtendInfo(extendInfo: IKaitianMenuExtendInfo): IKaitianMenuExtendInfo {
    return {
      ...extendInfo,
      extraDesc: this.getLocalizeFromNlsJSON(extendInfo?.extraDesc ?? ''),
    };
  }
}
