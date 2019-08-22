export const ITerminalService = Symbol('ITerminalService');
export interface ITerminalService {
  onMessage(msg: string): void;
  resize(rows: number, cols: number);
}
