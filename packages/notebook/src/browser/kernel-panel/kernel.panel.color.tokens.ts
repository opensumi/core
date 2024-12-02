import { localize } from '@opensumi/ide-core-browser';
import { registerColor } from '@opensumi/ide-theme/lib/common';

export const initKernelPanelColorToken = () => {
  registerColor(
    'kernel.panel.collapse.header.label',
    { dark: '#ffffffd9', light: '#000a1ae3', hcDark: null, hcLight: null },
    localize('kernel.panel.collapse.header.label', 'the collapse header label of kernel panel'),
    true,
  );

  registerColor(
    'kernel.panel.collapse.item',
    { dark: '#ffffffa6', light: '#000a1ae3', hcDark: null, hcLight: null },
    localize('kernel.panel.collapse.item', 'the collapse item color of kernel panel'),
    true,
  );

  registerColor(
    'kernel.panel.collapse.item.hover',
    { dark: '#ffffff14', light: '#151b2114', hcDark: null, hcLight: null },
    localize('kernel.panel.collapse.item.hover', 'the collapse item hover color of kernel panel'),
    true,
  );

  registerColor(
    'kernel.panel.collapse.header.close.all',
    { dark: '#878c93', light: '#3c8dff', hcDark: null, hcLight: null },
    localize('kernel.panel.collapse.header.close.all', 'the close all color of kernel panel'),
    true,
  );

  registerColor(
    'kernel.panel.collapse.header.close.hover',
    { dark: '#253944', light: '#151b2114', hcDark: null, hcLight: null },
    localize('kernel.panel.collapse.header.close.all', 'the close all color of kernel panel'),
    true,
  );
};
