import { Event } from '@ide-framework/ide-core-common';

export interface IPreferenceValue {
  name: string;
  value: string | number | boolean;
}

export const ITerminalPreference = Symbol('ITerminalPreference');
export interface ITerminalPreference {
  get<T = any>(key: string): T;
  onChange: Event<IPreferenceValue>;
  toJSON(): any;
}

export interface DefaultOptions {
  allowTransparency: boolean;
  macOptionIsMeta: false;
  cursorBlink: false;
  scrollback: number;
  tabStopWidth: number;
  fontSize: number;
}

export const OptionTypeName = {
  type: 'type',
  fontFamily: 'fontFamily',
  fontSize: 'fontSize',
  fontWeight: 'fontWeight',
  lineHeight: 'lineHeight',
  cursorBlink: 'cursorBlink',
  scrollback: 'scrollback',
};

export const DefaultOptionValue = {
  fontFamily: 'courier-new, courier, monospace',
  fontSize: 12,
};
