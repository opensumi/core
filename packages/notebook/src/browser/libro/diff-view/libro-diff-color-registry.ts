import { Color, ColorContribution, singleton } from '@difizen/libro-common/app';

import type { ColorRegistry } from '@difizen/libro-common/app';

@singleton({ contrib: ColorContribution })
export class LibroDiffColorRegistry implements ColorContribution {
  registerColors(colors: ColorRegistry): void {
    colors.register(
      // #region antd variable
      {
        id: 'libro.diff.added.cell.header.color',
        defaults: { dark: '#404C34', light: '#E4EADC' },
        description: '',
      },
      {
        id: 'libro.diff.removed.cell.header.color',
        defaults: { dark: '#5A3433', light: '#F2E7EA' },
        description: '',
      },
      {
        id: 'libro.diff.cell.header.text.color',
        defaults: { dark: '#e3e4e6', light: Color.rgba(0, 10, 26, 0.47) },
        description: '',
      },
      {
        id: 'libro.diff.cell.header.execution.color',
        defaults: { dark: '#6A83AA', light: '#6A83AA' },
        description: '',
      },
      {
        id: 'libro.diff.unchanged.cell.header.color',
        defaults: { dark: Color.rgba(255, 255, 255, 0.06), light: '#EAECF2' },
        description: '',
      },
      {
        id: 'libro.diff.container.color',
        defaults: { dark: '#1f2022', light: '#ffffff' },
        description: '',
      },
      {
        id: 'libro.diff.input.background.color',
        defaults: { dark: '#19191B', light: '#F4F6FB' },
        description: '',
      },
      {
        id: 'libro.diff.editor.background.color',
        defaults: { dark: '#1F2022', light: '#ffffff' },
        description: '',
      },
      {
        id: 'libro.diff.cell.border.color',
        defaults: { dark: '#3B3C42', light: '#D7DBE7' },
        description: '',
      },
      {
        id: 'libro.diff.editor.removed.color',
        defaults: { dark: '#4F2726', light: '#FAF0F0' },
        description: '',
      },
      {
        id: 'libro.diff.editor.added.color',
        defaults: { dark: '#334126', light: '#ECF4E3' },
        description: '',
      },
      {
        id: 'libro.diff.editor.line.insert.color',
        defaults: { dark: Color.rgba(83, 104, 48, 0.45), light: Color.rgba(189, 214, 151, 0.25) },
        description: '',
      },
      {
        id: 'libro.diff.editor.line.delete.color',
        defaults: { dark: Color.rgba(126, 50, 45, 0.45), light: Color.rgba(241, 212, 216, 0.35) },
        description: '',
      },
      {
        id: 'libro.diff.editor.char.insert.color',
        defaults: { dark: Color.rgba(16, 22, 3, 0.7), light: Color.rgba(67, 151, 36, 0.25) },
        description: '',
      },
      {
        id: 'libro.diff.editor.char.delete.color',
        defaults: { dark: Color.rgba(53, 15, 14, 0.7), light: Color.rgba(255, 0, 0, 0.2) },
        description: '',
      },
      {
        id: 'libro.diff.fold.background.color',
        defaults: { dark: Color.rgba(255, 255, 255, 0.08), light: Color.rgba(0, 10, 26, 0.02) },
        description: '',
      },
      {
        id: 'libro.diff.fold.hover.background.color',
        defaults: { dark: Color.rgba(255, 255, 255, 0.1), light: Color.rgba(0, 10, 26, 0.04) },
        description: '',
      },
      {
        id: 'libro.diff.fold.text.color',
        defaults: { dark: '#BDC0C4', light: Color.rgba(0, 10, 26, 0.47) },
        description: '',
      },
      {
        id: 'libro.diff.content.same.text.color',
        defaults: { dark: '#E3E4E6', light: Color.rgba(0, 10, 26, 0.68) },
        description: '',
      },
      {
        id: 'libro.diff.select.background.color',
        defaults: { dark: '#BCCEFF', light: '#e5ebf1' },
        description: '',
      },
      {
        id: 'libro.diff.select.highlight.background.color',
        defaults: { dark: '#C8D1E7', light: '#DDE6FF' },
        description: '',
      },
      {
        id: 'libro.diff.editor.gutter.number.color',
        defaults: { dark: '#a8aebf', light: '#A4AECB' },
        description: '',
      },
      {
        id: 'libro.diff.editor.intent.color',
        defaults: { dark: '#565C6D', light: '#A4AECB' },
        description: '',
      },
      {
        id: 'libro.editor.cursor.color',
        defaults: { dark: '#ffffff', light: '#000000' },
        description: '',
      },
    );
  }
}
