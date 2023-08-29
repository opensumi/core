declare module 'vscode' {
  // https://github.com/microsoft/vscode/issues/133935
  export interface SourceControlActionButton {
    command: Command;
    secondaryCommands?: Command[][];
    description?: string;
    enabled: boolean;
  }

  export interface SourceControl {
    actionButton?: SourceControlActionButton;
  }
}
