import { getColorRegistry, registerColor } from '@opensumi/ide-theme';

import darkTheme from './default-theme';
import lightTheme from './light-theme';

export const doOverrideColorToken = () => {
  const colorRegistry = getColorRegistry();

  colorRegistry.getColors().forEach(({ id }) => {
    if (darkTheme.colors[id] && lightTheme.colors[id]) {
      const preColor = colorRegistry.getColor(id);
      registerColor(
        id,
        {
          dark: darkTheme.colors[id],
          light: lightTheme.colors[id],
          hcDark: preColor.defaults!.hcDark || null,
          hcLight: preColor.defaults!.hcLight || null,
        },
        preColor.description,
      );
    }
  });
};
