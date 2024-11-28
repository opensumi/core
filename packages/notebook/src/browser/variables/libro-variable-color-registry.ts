import { Color, ColorContribution, singleton } from '@difizen/mana-app';

import type { ColorRegistry } from '@difizen/mana-app';

@singleton({ contrib: ColorContribution })
export class LibroVariableColorRegistry implements ColorContribution {
  // @inject(OpensumiInjector) injector: Injector;

  registerColors(colors: ColorRegistry): void {
    colors.register(
      // #region antd variable
      {
        id: 'libro.variable.search.background.color',
        defaults: {
          dark: '#ffffff0a',
          light: Color.rgba(0, 10, 26, 0.04),
        },
        description: '',
      },
      {
        id: 'libro.variable.search.text.color',
        defaults: { dark: '#878C93', light: Color.rgba(0, 10, 26, 0.26) },
        description: '',
      },
      {
        id: 'libro.variable.icon.color',
        defaults: {
          dark: Color.rgba(255, 255, 255, 0.45),
          light: Color.rgba(0, 10, 26, 0.47),
        },
        description: '',
      },
      {
        id: 'libro.variable.name.color',
        defaults: { dark: '#e3e4e6', light: '#000a1ac7' },
        description: '',
      },
      {
        id: 'libro.variable.title.color',
        defaults: { dark: '#ffffff59', light: '#000a1a78' },
        description: '',
      },
      {
        id: 'libro.variable.background.hover.color',
        defaults: { dark: '#ffffff14', light: '#151b2114' },
        description: '',
      },
      {
        id: 'libro.variable.description.color',
        defaults: { dark: '#bdc0c4', light: '#000a1aad' },
        description: '',
      },
      {
        id: 'libro.variable.tag.text.color',
        defaults: { dark: '#878c93', light: '#000a1aad' },
        description: '',
      },
      {
        id: 'libro.variable.tag.background.color',
        defaults: { dark: '#ffffff1f', light: '#0000001f' },
        description: '',
      },
      {
        id: 'libro.variable.border.color',
        defaults: {
          dark: '#ffffff14',
          light: '#151b2114',
        },
        description: '',
      },
      {
        id: 'libro.workbench.resource.spec.background',
        defaults: { dark: Color.rgba(255, 255, 255, 0.15), light: '#f9f9fb' },
        description: '',
      },
      {
        id: 'libro.workbench.panel.background.color',
        defaults: { dark: '#2B2C2E', light: '#f3f3f3' },
        description: '',
      },
      {
        id: 'libro.workbench.modal.title.color',
        defaults: { dark: '#EDEEEF', light: Color.rgba(0, 0, 0, 0.85) },
        description: '',
      },
      {
        id: 'libro.workbench.rating.input.background',
        defaults: { dark: Color.rgba(30, 30, 30, 0.48), light: '#fff' },
        description: '',
      },
      {
        id: 'libro.workbench.rating.input.border',
        defaults: {
          dark: Color.rgba(255, 255, 255, 0.07),
          light: Color.rgba(0, 10, 26, 0.07),
        },
        description: '',
      },
      {
        id: 'libro.workbench.popover.color',
        defaults: { dark: '#2F3032', light: '#ffffff' },
        description: '',
      },
      {
        id: 'libro.workbench.tour.description.color',
        defaults: { dark: '#BDC0C4', light: Color.rgba(0, 0, 0, 0.45) },
        description: '',
      },
      {
        id: 'libro.workbench.image.filter.container.background',
        defaults: { dark: '#2b2b2b', light: '#fafafa' },
        description: '',
      },
      {
        id: 'libro.workbench.image.filter.container.color',
        defaults: { dark: '#BDC0C4', light: '#000' },
        description: '',
      },
      {
        id: 'libro.workbench.image.filter.container.label.color',
        defaults: { dark: '#BDC0C4', light: '#000a1aad' },
        description: '',
      },
      {
        id: 'libro.workbench.image.filter.container.footer.background',
        defaults: { dark: '#2b2b2b', light: '#fff' },
        description: '',
      },
    );
  }
}
