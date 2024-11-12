import { URI } from '@opensumi/ide-core-common';

export function iconPath2URI(iconPath: URI | { light: URI; dark: URI }, themeType?: string): URI | undefined {
  if (URI.isUri(iconPath)) {
    return 'codeUri' in iconPath ? iconPath : new URI((iconPath as URI).toString());
  }

  if ((iconPath?.dark || iconPath?.light) && themeType) {
    return themeType === 'dark' ? new URI(iconPath.dark.toString()) : new URI(iconPath.light.toString());
  }
}
