export const ITerminalRestore = Symbol('ITerminalRestore');
export interface ITerminalRestore {
  restore(): Promise<void>;
  save(): void;
}
