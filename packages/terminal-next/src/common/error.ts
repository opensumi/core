export interface ITerminalError {
  id: string;
  stopped: boolean;
  reconnected?: boolean;
  message: string;
}
