import { Injectable, Autowired } from '@opensumi/di';
import { LifeCyclePhase, URI } from '@opensumi/ide-core-common';
import { ThemeContribution, IProductIconService } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

export type ThemesSchema = Array<ThemeContribution>;

// TODO 需等待 monaco-colors 初始化完成 才能注册
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
