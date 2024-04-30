import { ITheme } from '@xterm/xterm';

export const ITerminalTheme = Symbol('ITerminalTheme');
export interface ITerminalTheme {
  terminalTheme: ITheme;
}
