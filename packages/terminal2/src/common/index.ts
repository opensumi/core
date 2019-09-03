export const ITerminalService = Symbol('ITerminalService');
export interface ITerminalService {
  onMessage(id: number, msg: string): void;
  resize(id: number, rows: number, cols: number);
}
