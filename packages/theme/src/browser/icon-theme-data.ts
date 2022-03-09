import { Injectable, Autowired } from '@opensumi/di';
import { getDebugLogger, URI, parseWithComments, formatLocalize } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { StaticResourceService } from '@opensumi/ide-static-resource/lib/browser';

import { IIconTheme } from '../common';

@Injectable({ multiple: true })
export class IconThemeData implements IIconTheme {
  hasFileIcons: boolean;
  hasFolderIcons: boolean;
  hidesExplorerArrows: boolean;
  styleSheetContent: string;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired()
  private readonly staticResourceService: StaticResourceService;

  async load(location: URI) {
    const ret = await this.fileServiceClient.readFile(location.toString());
    let contentValue = {} as IconThemeDocument;
    try {
      contentValue = parseWithComments<IconThemeDocument>(ret.content.toString());
    } catch (error) {
      getDebugLogger().log(formatLocalize('error.cannotparseicontheme', location.codeUri.fsPath));
    }

    const result = processIconThemeDocument(location, contentValue, this.staticResourceService);
    this.hasFileIcons = result.hasFileIcons;
    this.hasFolderIcons = result.hasFolderIcons;
    this.hidesExplorerArrows = result.hidesExplorerArrows;
    this.styleSheetContent = result.content;
    return result.content;
  }
}

// tslint:disable: forin
interface IconDefinition {
  iconPath: string;
  fontColor: string;
  fontCharacter: string;
  fontSize: string;
  fontId: string;
}

interface FontDefinition {
  id: string;
  weight: string;
  style: string;
  size: string;
  src: { path: string; format: string }[];
}

// 图标名与图标定义的映射关系
interface IconsAssociation {
  folder?: string;
  file?: string;
  folderExpanded?: string;
  rootFolder?: string;
  rootFolderExpanded?: string;
  folderNames?: { [folderName: string]: string };
  folderNamesExpanded?: { [folderName: string]: string };
  fileExtensions?: { [extension: string]: string };
  fileNames?: { [fileName: string]: string };
  languageIds?: { [languageId: string]: string };
}

interface IconThemeDocument extends IconsAssociation {
  iconDefinitions: { [key: string]: IconDefinition };
  fonts: FontDefinition[];
  light?: IconsAssociation;
  highContrast?: IconsAssociation;
  hidesExplorerArrows?: boolean;
}

/**
 * 将图标配置信息转成 CSS
 * @param iconThemeDocumentLocation
 * @param iconThemeDocument
 */
function processIconThemeDocument(
  iconThemeDocumentLocation: URI,
  iconThemeDocument: IconThemeDocument,
  staticResourceService: StaticResourceService,
): { content: string; hasFileIcons: boolean; hasFolderIcons: boolean; hidesExplorerArrows: boolean } {
  const result = {
    content: '',
    hasFileIcons: false,
    hasFolderIcons: false,
    hidesExplorerArrows: !!iconThemeDocument.hidesExplorerArrows,
  };

  if (!iconThemeDocument.iconDefinitions) {
    return result;
  }
  const selectorByDefinitionId: { [def: string]: string[] } = {};

  function resolvePath(path: string) {
    const targetPath = iconThemeDocumentLocation.path.dir.join(path.replace(/^\.\//, ''));
    const targetLocation = iconThemeDocumentLocation.withPath(targetPath);
    if (iconThemeDocumentLocation.scheme === 'https') {
      return targetLocation.toString();
    }
    // file 协议的需要走 static-resource
    return staticResourceService.resolveStaticResource(targetLocation);
  }

  /**
   * 将图标关联关系转成css选择器数组，支持主题的light、hc传入
   * @param associations
   * @param baseThemeClassName
   */
  function collectSelectors(associations: IconsAssociation | undefined, baseThemeClassName?: string) {
    // 将定义的图标名插入对应的选择器列表
    function addSelector(selector: string, defId: string) {
      if (defId) {
        let list = selectorByDefinitionId[defId];
        if (!list) {
          list = selectorByDefinitionId[defId] = [];
        }
        list.push(selector);
      }
    }
    if (associations) {
      let qualifier = '.show-file-icons';
      if (baseThemeClassName) {
        qualifier = baseThemeClassName + ' ' + qualifier;
      }

      if (associations.folder) {
        addSelector(`${qualifier} .folder-icon::before`, associations.folder);
        result.hasFolderIcons = true;
      }

      if (associations.folderExpanded) {
        addSelector(`${qualifier} .folder-icon.expanded::before`, associations.folderExpanded);
        result.hasFolderIcons = true;
      }

      const rootFolder = associations.rootFolder || associations.folder;
      const rootFolderExpanded = associations.rootFolderExpanded || associations.folderExpanded;

      if (rootFolder) {
        addSelector(`${qualifier} .rootfolder-icon::before`, rootFolder);
        result.hasFolderIcons = true;
      }

      if (rootFolderExpanded) {
        addSelector(`${qualifier} .rootfolder-icon.expanded::before`, rootFolderExpanded);
        result.hasFolderIcons = true;
      }

      if (associations.file) {
        addSelector(`${qualifier} .file-icon::before`, associations.file);
        result.hasFileIcons = true;
      }

      const folderNames = associations.folderNames;
      if (folderNames) {
        // eslint-disable-next-line guard-for-in
        for (const folderName in folderNames) {
          addSelector(
            `${qualifier} .${escapeCSS(folderName.toLowerCase())}-name-folder-icon.folder-icon::before`,
            folderNames[folderName],
          );
          result.hasFolderIcons = true;
        }
      }
      const folderNamesExpanded = associations.folderNamesExpanded;
      if (folderNamesExpanded) {
        // eslint-disable-next-line guard-for-in
        for (const folderName in folderNamesExpanded) {
          addSelector(
            `${qualifier} .${escapeCSS(folderName.toLowerCase())}-name-folder-icon.folder-icon.expanded::before`,
            folderNamesExpanded[folderName],
          );
          result.hasFolderIcons = true;
        }
      }

      const languageIds = associations.languageIds;
      if (languageIds) {
        if (!languageIds.jsonc && languageIds.json) {
          languageIds.jsonc = languageIds.json;
        }
        // eslint-disable-next-line guard-for-in
        for (const languageId in languageIds) {
          addSelector(
            `${qualifier} .${escapeCSS(languageId)}-lang-file-icon.file-icon::before`,
            languageIds[languageId],
          );
          result.hasFileIcons = true;
        }
      }
      const fileExtensions = associations.fileExtensions;
      if (fileExtensions) {
        // eslint-disable-next-line guard-for-in
        for (const fileExtension in fileExtensions) {
          const selectors: string[] = [];
          const segments = fileExtension.toLowerCase().split('.');
          if (segments.length) {
            for (let i = 0; i < segments.length; i++) {
              selectors.push(`.${escapeCSS(segments.slice(i).join('.'))}-ext-file-icon`);
            }
            selectors.push('.ext-file-icon'); // extra segment to increase file-ext score
          }
          addSelector(`${qualifier} ${selectors.join('')}.file-icon::before`, fileExtensions[fileExtension]);
          result.hasFileIcons = true;
        }
      }
      const fileNames = associations.fileNames;
      if (fileNames) {
        // eslint-disable-next-line guard-for-in
        for (let fileName in fileNames) {
          const selectors: string[] = [];
          fileName = fileName.toLowerCase();
          selectors.push(`.${escapeCSS(fileName)}-name-file-icon`);
          const segments = fileName.split('.');
          if (segments.length) {
            for (let i = 1; i < segments.length; i++) {
              selectors.push(`.${escapeCSS(segments.slice(i).join('.'))}-ext-file-icon`);
            }
            selectors.push('.ext-file-icon'); // extra segment to increase file-ext score
          }
          addSelector(`${qualifier} ${selectors.join('')}.file-icon::before`, fileNames[fileName]);
          result.hasFileIcons = true;
        }
      }
    }
  }
  collectSelectors(iconThemeDocument);
  collectSelectors(iconThemeDocument.light, '.vs');
  collectSelectors(iconThemeDocument.highContrast, '.hc-black');

  if (!result.hasFileIcons && !result.hasFolderIcons) {
    return result;
  }

  const cssRules: string[] = [];

  const fonts = iconThemeDocument.fonts;
  if (Array.isArray(fonts)) {
    fonts.forEach((font) => {
      const src = font.src.map((l) => `url('${resolvePath(l.path)}') format('${l.format}')`).join(', ');
      cssRules.push(
        `@font-face { src: ${src}; font-family: '${font.id}'; font-weight: ${font.weight}; font-style: ${font.style}; }`,
      );
    });
    cssRules.push(
      `.show-file-icons .file-icon::before, .show-file-icons .folder-icon::before, .show-file-icons .rootfolder-icon::before { font-family: '${
        fonts[0].id
      }'; font-size: ${fonts[0].size || '150%'}}`,
    );
  }

  // eslint-disable-next-line guard-for-in
  for (const defId in selectorByDefinitionId) {
    const selectors = selectorByDefinitionId[defId];
    const definition = iconThemeDocument.iconDefinitions[defId];
    if (definition) {
      if (definition.iconPath) {
        cssRules.push(
          `${selectors.join(', ')} { content: ' '; background-image: url("${resolvePath(definition.iconPath)}"); }`,
        );
      }
      if (definition.fontCharacter || definition.fontColor) {
        let body = '';
        if (definition.fontColor) {
          body += ` color: ${definition.fontColor};`;
        }
        if (definition.fontCharacter) {
          body += ` content: '${definition.fontCharacter}';`;
        }
        if (definition.fontSize) {
          body += ` font-size: ${definition.fontSize};`;
        }
        if (definition.fontId) {
          body += ` font-family: ${definition.fontId};`;
        }
        cssRules.push(`${selectors.join(', ')} { ${body} }`);
      }
    }
  }
  result.content = cssRules.join('\n');
  return result;
}

function escapeCSS(str: string) {
  str = str.replace(/[\11\12\14\15\40]/g, '/'); // HTML class names can not contain certain whitespace characters, use / instead, which doesn't exist in file names.
  return window.CSS.escape(str);
}
