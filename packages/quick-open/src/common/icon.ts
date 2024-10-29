import { URI } from '@opensumi/ide-core-common';

export function iconPath2URI(iconPath: URI | { light: URI; dark: URI }, themeType?: string): URI | undefined {
  if (URI.isUri(iconPath)) {
    const tmpIconPath = iconPath as URI;

    return Object.prototype.hasOwnProperty.call(tmpIconPath, 'codeUri') ? tmpIconPath : new URI(tmpIconPath.toString());
  }

  if ((iconPath.dark || iconPath.light) && themeType) {
    return themeType === 'dark' ? new URI(iconPath.dark.toString()) : new URI(iconPath.light.toString());
  }
}
