import { Injectable, Autowired } from '@opensumi/di';
import { URI, path, LifeCyclePhase } from '@opensumi/ide-core-common';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser/static.definition';
import { ThemeContribution, IIconService, FontIconDefinition, IconFontFamily } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';

export type ThemesSchema = Array<ThemeContribution>;

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

@Injectable()
@Contributes('icons')
@LifeCycle(LifeCyclePhase.Initialize)
export class IconsContributionPoint extends VSCodeContributePoint<IconSchema> {
  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  @Autowired()
  private readonly staticResourceService: StaticResourceService;

  @Autowired(IIconService)
  protected readonly iconService: IIconService;

  contribute(): void | Promise<void> {
    const codiconDeinitions: FontIconDefinition[] = [];
    const fontFaces: { [k: string]: IconFontFamily } = {};

    for (const { extensionId, contributes } of this.contributesMap) {
      Object.keys(contributes).forEach((k) => {
        const icon = contributes[k];
        const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
        if (extension) {
          const fontFamily = `${extensionId}/${icon.default.fontPath}`;
          const defaultIcon = icon.default;
          if (typeof defaultIcon === 'string') {
            // iconRegistry.registerIcon(id, { id: defaultIcon }, iconContribution.description);
          } else if (
            typeof defaultIcon === 'object' &&
            typeof defaultIcon.fontPath === 'string' &&
            typeof defaultIcon.fontCharacter === 'string'
          ) {
            if (!fontFaces[fontFamily]) {
              const fontPath = URI.from(extension.uri!).resolve(icon.default.fontPath);
              const format = path.extname(defaultIcon.fontPath).substring(1);
              if (format && format[0]) {
                fontFaces[fontFamily] = {
                  source: this.staticResourceService.resolveStaticResource(fontPath).toString(),
                  format,
                  fontFamily,
                  display: 'blok',
                };
              }
            }
            codiconDeinitions.push({ content: icon.default.fontCharacter, id: k, fontFamily });
          }
        }
      });
    }

    const fontFamilies = Object.keys(fontFaces).map((k) => fontFaces[k]);

    this.iconService.registerFontIcons(codiconDeinitions, fontFamilies);
  }
}
