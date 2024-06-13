import { localize } from '@opensumi/ide-core-common';
import { getColorRegistry, registerColor } from '@opensumi/ide-theme';

import darkTheme from './default-theme';
import lightTheme from './light-theme';

export const overrideColorToken = () => {
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

export const overrideMonacoColorToken = () => {
  /**
   * quickInputListFocusBackground token
   */
  registerColor(
    'vscode.quickInputList.focusBackground',
    { light: '#151b2114', dark: '#5F656B40', hcDark: null, hcLight: null },
    'Quick picker background color for the focused item.',
  );

  /**
   * quickInputListFocusForeground token
   */
  registerColor(
    'quickInputList.focusForeground',
    { dark: '#ffffff', light: '#151b21', hcDark: null, hcLight: null },
    'Quick picker foreground color for the focused item.',
  );
};
