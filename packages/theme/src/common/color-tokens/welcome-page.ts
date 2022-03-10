import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../color-registry';

export const welcomePagebtnBackground = registerColor(
  'welcomePage.buttonBackground',
  { dark: null, light: null, hc: null },
  localize('welcomePage.buttonBackground', 'Background color for the buttons on the Welcome page.'),
);
export const welcomePageBtnHoverBackground = registerColor(
  'welcomePage.buttonHoverBackground',
  { dark: null, light: null, hc: null },
  localize('welcomePage.buttonHoverBackground', 'Hover background color for the buttons on the Welcome page.'),
);
export const welcomePageBackground = registerColor(
  'welcomePage.background',
  { light: null, dark: null, hc: null },
  localize('welcomePage.background', 'Background color for the Welcome page.'),
);
export const embeddedEditorBackground = registerColor(
  'walkThrough.embeddedEditorBackground',
  { dark: null, light: null, hc: null },
  localize(
    'walkThrough.embeddedEditorBackground',
    'Background color for the embedded editors on the Interactive Playground.',
  ),
);
