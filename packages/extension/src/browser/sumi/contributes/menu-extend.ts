import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { IMenuRegistry } from '@opensumi/ide-core-browser/lib/menu/next';
import { ISumiMenuExtendInfo } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { IContributeMenubarItem } from '../../../common/sumi/extension';

export type KtMenubarsSchema = IContributeMenubarItem[];

@Injectable()
@Contributes('menu-extend')
@LifeCycle(LifeCyclePhase.Starting)
export class MenuExtendContributionPoint extends VSCodeContributePoint<KtMenubarsSchema> {
  @Autowired(IMenuRegistry)
  private readonly menuRegistry: IMenuRegistry;

  contribute() {
    for (const menuPosition of Object.keys(this.json)) {
      const menuActions = this.json[menuPosition] as Array<ISumiMenuExtendInfo>;

      this.addDispose(
        this.menuRegistry.registerMenuExtendInfo(menuPosition, menuActions.map(this.handleExtendInfo.bind(this))),
      );
    }
  }

  handleExtendInfo(extendInfo: ISumiMenuExtendInfo): ISumiMenuExtendInfo {
    return {
      ...extendInfo,
      extraDesc: this.getLocalizeFromNlsJSON(extendInfo?.extraDesc ?? ''),
    };
  }
}
