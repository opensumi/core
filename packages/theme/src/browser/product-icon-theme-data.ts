import * as parser from 'jsonc-parser';

import { Injectable, Autowired } from '@opensumi/di';
import { getDebugLogger, URI, formatLocalize, ThemeIcon, isString, path, Logger } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';

import { IProductIconTheme, ExtensionData, ThemeContribution } from '../common';
import {
  IconContribution,
  IconDefinition,
  IconFontDefinition,
  IconFontSource,
  getIconRegistry,
} from '../common/icon-registry';

export const fontIdRegex = '^([\\w_-]+)$';
export const fontStyleRegex = '^(normal|italic|(oblique[ \\w\\s-]+))$';
export const fontWeightRegex = '^(normal|bold|lighter|bolder|(\\d{0-1000}))$';
export const fontSizeRegex = '^([\\w .%_-]+)$';
export const fontFormatRegex = '^woff|woff2|truetype|opentype|embedded-opentype|svg$';

interface ProductIconThemeDocument {
  iconDefinitions: Map<string, IconDefinition>;
}
@Injectable({ multiple: true })
export class ProductIconThemeData implements IProductIconTheme {
  id: string;
  label: string;
  settingsId: string;
  description?: string;
  isLoaded: boolean;
  location?: URI;
  extensionData?: ExtensionData;
  watch?: boolean;

  iconThemeDocument: ProductIconThemeDocument = { iconDefinitions: new Map() };

  styleSheetContent?: string;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired()
  private readonly staticResourceService: StaticResourceService;

  @Autowired()
  private logger: Logger;

  private constructor(id: string, label: string, settingsId: string) {
    this.id = id;
    this.label = label;
    this.settingsId = settingsId;
    this.isLoaded = false;
  }

  async load(location: URI) {
    this.location = location;
    const warnings: string[] = [];
    try {
      this.iconThemeDocument = await _loadProductIconThemeDocument(this.fileServiceClient, location, warnings);
    } catch (error) {
      // TODO more error handling
      getDebugLogger().log(formatLocalize('error.cannotparseicontheme', location.codeUri.fsPath));
    }

    this.isLoaded = true;
    if (warnings.length) {
      this.logger.error(formatLocalize('error.parseicondefs', location.toString(), warnings.join('\n')));
    }
    return this.styleSheetContent;
  }

  public getIcon(iconContribution: IconContribution): IconDefinition | undefined {
    return _resolveIconDefinition(iconContribution, this.iconThemeDocument);
  }

  static fromExtensionTheme(
    iconTheme: ThemeContribution,
    iconThemeLocation: URI,
    extensionData: ExtensionData,
  ): ProductIconThemeData {
    const id = extensionData.extensionId + '-' + iconTheme.id;
    const label = iconTheme.label;
    const settingsId = iconTheme.id as string;

    const themeData = new ProductIconThemeData(id, label, settingsId);

    themeData.description = iconTheme.description;
    themeData.location = iconThemeLocation;
    themeData.extensionData = extensionData;
    themeData.isLoaded = false;
    return themeData;
  }
}
const iconRegistry = getIconRegistry();

function _resolveIconDefinition(
  iconContribution: IconContribution,
  iconThemeDocument: ProductIconThemeDocument,
): IconDefinition | undefined {
  const iconDefinitions = iconThemeDocument.iconDefinitions;
  let definition: IconDefinition | undefined = iconDefinitions.get(iconContribution.id);
  let defaults = iconContribution.defaults;
  while (!definition && ThemeIcon.isThemeIcon(defaults)) {
    // look if an inherited icon has a definition
    const ic = iconRegistry.getIcon(defaults.id);
    if (ic) {
      definition = iconDefinitions.get(ic.id);
      defaults = ic.defaults;
    } else {
      return undefined;
    }
  }
  if (definition) {
    return definition;
  }
  if (!ThemeIcon.isThemeIcon(defaults)) {
    return defaults as IconDefinition;
  }
  return undefined;
}

async function _loadProductIconThemeDocument(
  fileService: IFileServiceClient,
  location: URI,
  warnings: string[],
): Promise<ProductIconThemeDocument> {
  const ret = await fileService.readFile(location.toString());
  const parseErrors: parser.ParseError[] = [];

  const contentValue = parser.parse(ret.content.toString(), parseErrors);

  if (parseErrors.length > 0) {
    return Promise.reject(
      new Error(
        formatLocalize(
          'error.cannotparseicontheme',
          parseErrors.map((e) => e.error),
        ),
      ),
    );
  } else if (typeof contentValue !== 'object') {
    return Promise.reject(new Error(formatLocalize('error.invalidformat')));
  } else if (!contentValue.iconDefinitions || !Array.isArray(contentValue.fonts) || !contentValue.fonts.length) {
    return Promise.reject(new Error(formatLocalize('error.missingProperties')));
  }

  const iconThemeDocumentLocationDirname = path.dirname(location.toString());

  const sanitizedFonts: Map<string, IconFontDefinition> = new Map();
  for (const font of contentValue.fonts) {
    if (isString(font.id) && font.id.match(fontIdRegex)) {
      const fontId = font.id;

      let fontWeight;
      if (isString(font.weight) && font.weight.match(fontWeightRegex)) {
        fontWeight = font.weight;
      } else {
        warnings.push(
          formatLocalize('error.fontWeight', "Invalid font weight in font '{0}'. Ignoring setting.", font.id),
        );
      }

      let fontStyle;
      if (isString(font.style) && font.style.match(fontStyleRegex)) {
        fontStyle = font.style;
      } else {
        warnings.push(
          formatLocalize('error.fontStyle', "Invalid font style in font '{0}'. Ignoring setting.", font.id),
        );
      }

      const sanitizedSrc: IconFontSource[] = [];
      if (Array.isArray(font.src)) {
        for (const s of font.src) {
          if (isString(s.path) && isString(s.format) && s.format.match(fontFormatRegex)) {
            const iconFontLocation = path.join(iconThemeDocumentLocationDirname, s.path);
            sanitizedSrc.push({ location: URI.parse(iconFontLocation), format: s.format });
          } else {
            warnings.push(
              formatLocalize('error.fontSrc', "Invalid font source in font '{0}'. Ignoring source.", font.id),
            );
          }
        }
      }
      if (sanitizedSrc.length) {
        sanitizedFonts.set(fontId, { weight: fontWeight, style: fontStyle, src: sanitizedSrc });
      } else {
        warnings.push(
          formatLocalize('error.noFontSrc', "No valid font source in font '{0}'. Ignoring font definition.", font.id),
        );
      }
    } else {
      warnings.push(
        formatLocalize('error.fontId', "Missing or invalid font id '{0}'. Skipping font definition.", font.id),
      );
    }
  }

  const iconDefinitions = new Map<string, IconDefinition>();

  const primaryFontId = contentValue.fonts[0].id as string;

  // eslint-disable-next-line guard-for-in
  for (const iconId in contentValue.iconDefinitions) {
    const definition = contentValue.iconDefinitions[iconId];
    if (isString(definition.fontCharacter)) {
      const fontId = definition.fontId ?? primaryFontId;
      const fontDefinition = sanitizedFonts.get(fontId);
      if (fontDefinition) {
        const font = { id: `pi-${fontId}`, definition: fontDefinition };
        iconDefinitions.set(iconId, { fontCharacter: definition.fontCharacter, font });
      } else {
        warnings.push(formatLocalize('error.icon.font', "Skipping icon definition '{0}'. Unknown font.", iconId));
      }
    } else {
      warnings.push(
        formatLocalize('error.icon.fontCharacter', "Skipping icon definition '{0}'. Unknown fontCharacter.", iconId),
      );
    }
  }
  return { iconDefinitions };
}
