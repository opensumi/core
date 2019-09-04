export const ITerminalServicePath = 'ITerminalServicePath';
export const ITerminalService = Symbol('ITerminalService');
export interface ITerminalService {
  create(id: string, rows: number, cols: number, cwd: string);
  onMessage(id: number, msg: string): void;
  resize(id: number, rows: number, cols: number);
}

export interface Terminal {

  /**
   * The name of the terminal.
   */
  readonly name: string;

  /**
   * The process ID of the shell process.
   */
  readonly processId: Thenable<number>;

  /**
   * Send text to the terminal. The text is written to the stdin of the underlying pty process
   * (shell) of the terminal.
   *
   * @param text The text to send.
   * @param addNewLine Whether to add a new line to the text being sent, this is normally
   * required to run a command in the terminal. The character(s) added are \n or \r\n
   * depending on the platform. This defaults to `true`.
   */
  sendText(text: string, addNewLine?: boolean): void;

  /**
   * Show the terminal panel and reveal this terminal in the UI.
   *
   * @param preserveFocus When `true` the terminal will not take focus.
   */
  show(preserveFocus?: boolean): void;

  /**
   * Hide the terminal panel if this terminal is currently showing.
   */
  hide(): void;

  /**
   * Dispose and free associated resources.
   */
  dispose(): void;
}
