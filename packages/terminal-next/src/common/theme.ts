import { ITheme } from 'xterm';

export const ITerminalTheme = Symbol('ITerminalTheme');
export interface ITerminalTheme {
  terminalTheme: ITheme;
}
