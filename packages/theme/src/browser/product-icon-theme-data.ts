import * as parser from 'jsonc-parser';

import { Autowired, Injectable } from '@opensumi/di';
import { Logger, ThemeIcon, URI, isString, path } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { ExtensionData, IProductIconTheme, IThemeContribution } from '../common';
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
  private logger: Logger;

  constructor(id: string, label: string, settingsId: string) {
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
      this.logger.error(`parse icon theme failed ${location.codeUri.fsPath}`);
    }

    this.isLoaded = true;
    if (warnings.length) {
      this.logger.warn(warnings.toString());
    }
    return this.styleSheetContent;
  }

  public getIcon(iconContribution: IconContribution): IconDefinition | undefined {
    return _resolveIconDefinition(iconContribution, this.iconThemeDocument);
  }

  static fromExtensionTheme(
    iconTheme: IThemeContribution,
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
    // sumi icon proxy
    if (defaults.alias) {
      const alias = defaults.alias;
      const definitionProxy = alias.find((iconId: string) => iconDefinitions.get(iconId));
      return definitionProxy ? iconDefinitions.get(definitionProxy) : undefined;
    }
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
    return Promise.reject(new Error('Parse product icon theme failed'));
  } else if (typeof contentValue !== 'object') {
    return Promise.reject(new Error('Invalid icon theme format'));
  } else if (!contentValue.iconDefinitions || !Array.isArray(contentValue.fonts) || !contentValue.fonts.length) {
    return Promise.reject(new Error('Missing properties: iconDefinitions or fonts'));
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
        warnings.push(`Invalid font weight in font '${font.id}'. Ignoring setting.`);
      }

      let fontStyle;
      if (isString(font.style) && font.style.match(fontStyleRegex)) {
        fontStyle = font.style;
      } else {
        warnings.push(`Invalid font style in font '${font.id}'. Ignoring setting.`);
      }

      const sanitizedSrc: IconFontSource[] = [];
      if (Array.isArray(font.src)) {
        for (const s of font.src) {
          if (isString(s.path) && isString(s.format) && s.format.match(fontFormatRegex)) {
            const iconFontLocation = path.join(iconThemeDocumentLocationDirname, s.path);
            sanitizedSrc.push({ location: URI.parse(iconFontLocation), format: s.format });
          } else {
            warnings.push(`Invalid font source in font '${font.id}'. Ignoring source.`);
          }
        }
      }
      if (sanitizedSrc.length) {
        sanitizedFonts.set(fontId, { weight: fontWeight, style: fontStyle, src: sanitizedSrc });
      } else {
        warnings.push(`No valid font source in font '${font.id}'. Ignoring font definition.`);
      }
    } else {
      warnings.push(`Missing or invalid font id '${font.id}'. Skipping font definition.`);
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
        // pi ?
        const font = { id: `pi-${fontId}`, definition: fontDefinition };
        iconDefinitions.set(iconId, { fontCharacter: definition.fontCharacter, font });
      } else {
        warnings.push(`Skipping icon definition '${iconId}'. Unknown font.`);
      }
    } else {
      warnings.push(`Skipping icon definition '${iconId}'. Unknown fontCharacter.`);
    }
  }
  return { iconDefinitions };
}
