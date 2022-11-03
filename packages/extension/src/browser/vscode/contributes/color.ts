import { Injectable, Autowired } from '@opensumi/di';
import { replaceLocalizePlaceholder, localize } from '@opensumi/ide-core-browser';
import { LifeCyclePhase } from '@opensumi/ide-core-common';
import { ExtColorContribution, IThemeService } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';

export type ColorsSchema = Array<ExtColorContribution>;
const colorIdPattern = '^\\w+[.\\w+]*$';
@Injectable()
@Contributes('colors')
@LifeCycle(LifeCyclePhase.Ready)
export class ColorsContributionPoint extends VSCodeContributePoint<ColorsSchema> {
  @Autowired(IThemeService)
  themeService: IThemeService;

  static schema = {
    description: localize('contributes.color', 'Contributes extension defined themable colors'),
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: localize('contributes.color.id', 'The identifier of the themable color'),
          pattern: colorIdPattern,
          patternErrorMessage: localize('contributes.color.id.format', 'Identifiers should be in the form aa[.bb]*'),
        },
        description: {
          type: 'string',
          description: localize('contributes.color.description', 'The description of the themable color'),
        },
        defaults: {
          type: 'object',
          properties: {
            light: {
              description: localize(
                'contributes.defaults.light',
                'The default color for light themes. Either a color value in hex (#RRGGBB[AA]) or the identifier of a themable color which provides the default.',
              ),
              type: 'string',
              anyOf: [{ type: 'string', format: 'color-hex' }],
            },
            dark: {
              description: localize(
                'contributes.defaults.dark',
                'The default color for dark themes. Either a color value in hex (#RRGGBB[AA]) or the identifier of a themable color which provides the default.',
              ),
              type: 'string',
              anyOf: [{ type: 'string', format: 'color-hex' }],
            },
            highContrast: {
              description: localize(
                'contributes.defaults.highContrast',
                'The default color for high contrast dark themes. Either a color value in hex (#RRGGBB[AA]) or the identifier of a themable color which provides the default. If not provided, the `dark` color is used as default for high contrast dark themes.',
              ),
              type: 'string',
              anyOf: [{ type: 'string', format: 'color-hex' }],
            },
            highContrastLight: {
              description: localize(
                'contributes.defaults.highContrastLight',
                'The default color for high contrast light themes. Either a color value in hex (#RRGGBB[AA]) or the identifier of a themable color which provides the default. If not provided, the `light` color is used as default for high contrast light themes.',
              ),
              type: 'string',
              anyOf: [{ type: 'string', format: 'color-hex' }],
            },
          },
        },
      },
    },
  };

  contribute() {
    for (const contrib of this.contributesMap) {
      const { contributes } = contrib;
      for (const color of contributes) {
        if (color && color.description) {
          color.description = replaceLocalizePlaceholder(color.description) as string;
        }
        this.themeService.registerColor(color);
      }
    }
  }
}
