import { URI } from '@opensumi/ide-core-common';

export function iconPath2URI(iconPath: any, themeType?: string): URI | undefined {
  if (URI.isUri(iconPath)) {
    return iconPath;
  }

  if ((iconPath.dark || iconPath.light) && themeType) {
    return themeType === 'dark' ? new URI(iconPath.dark.toString()) : new URI(iconPath.light.toString());
  }
}
