import { Autowired, Injectable } from '@opensumi/di';
import { StaticResourceService } from '@opensumi/ide-core-browser/lib/static-resource/static.definition';
import { ILogger, LifeCyclePhase, URI, localize, path } from '@opensumi/ide-core-common';
import { IIconService, IProductIconService, IThemeContribution } from '@opensumi/ide-theme';
import { getIconRegistry } from '@opensumi/ide-theme/lib/common/icon-registry';

import { Contributes, LifeCycle, VSCodeContributePoint } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

export type ThemesSchema = Array<IThemeContribution>;

@Injectable()
@Contributes('iconThemes')
@LifeCycle(LifeCyclePhase.Initialize)
export class IconThemesContributionPoint extends VSCodeContributePoint<ThemesSchema> {
  @Autowired(IIconService)
  protected readonly iconService: IIconService;

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
        this.iconService.registerIconThemes(themes, URI.from(extension.uri!));
      }
    }
  }
}

export interface IconSchema {
  [key: string]: {
    description: string;
    default: {
      fontPath: string;
      fontCharacter: string;
    };
  };
}

const formatMap: Record<string, string> = {
  ttf: 'truetype',
  woff: 'woff',
  woff2: 'woff2',
};

@Injectable()
@Contributes('icons')
@LifeCycle(LifeCyclePhase.Initialize)
export class IconsContributionPoint extends VSCodeContributePoint<IconSchema> {
  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  @Autowired(IProductIconService)
  protected readonly productIconService: IProductIconService;

  @Autowired()
  private readonly staticResourceService: StaticResourceService;

  @Autowired(ILogger)
  private logger: ILogger;

  private iconRegistry = getIconRegistry();

  contribute(): void | Promise<void> {
    for (const { extensionId, contributes } of this.contributesMap) {
      Object.keys(contributes).forEach((id) => {
        const icon = contributes[id];
        const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
        if (extension) {
          const defaultIcon = icon.default;
          if (typeof defaultIcon === 'string') {
            this.iconRegistry.registerIcon(id, { id: defaultIcon }, icon.description);
          } else if (
            typeof defaultIcon === 'object' &&
            typeof defaultIcon.fontPath === 'string' &&
            typeof defaultIcon.fontCharacter === 'string'
          ) {
            const fontPath = URI.from(extension.uri!).resolve(icon.default.fontPath);
            const fileExt = path.extname(defaultIcon.fontPath).substring(1);
            const format = formatMap[fileExt];
            if (!format) {
              this.logger.warn(
                localize(
                  'invalid.icons.default.fontPath.extension',
                  `Expected \`contributes.icons.default.fontPath\` to have file extension 'woff', woff2' or 'ttf', is '${fileExt}'.`,
                ),
              );
              return;
            }
            const fontId = path.join(extensionId, defaultIcon.fontPath);
            const definition = this.iconRegistry.registerIconFont(fontId, {
              src: [{ location: this.staticResourceService.resolveStaticResource(fontPath), format }],
            });
            this.iconRegistry.registerIcon(
              id,
              {
                fontCharacter: defaultIcon.fontCharacter,
                font: {
                  id: fontId,
                  definition,
                },
              },
              icon.description,
            );
          }
        }
      });
    }
    this.productIconService.updateProductIconThemes();
  }
}
