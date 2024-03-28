import { Autowired, Injectable } from '@opensumi/di';
import { LifeCyclePhase, URI } from '@opensumi/ide-core-common';
import { IProductIconService, IThemeContribution } from '@opensumi/ide-theme';

import { Contributes, LifeCycle, VSCodeContributePoint } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

export type ThemesSchema = Array<IThemeContribution>;

@Injectable()
@Contributes('productIconThemes')
@LifeCycle(LifeCyclePhase.Initialize)
export class ProductIconThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IProductIconService)
  protected readonly productIconService: IProductIconService;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  contribute() {
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const themes = contributes.map((t) => ({
        ...t,
        label: this.getLocalizeFromNlsJSON(t.label, extensionId),
        extensionId,
      }));

      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (extension) {
        this.productIconService.registerProductIconThemes(themes, URI.from(extension.uri!));
      }
    }
  }
}
