export interface IProcessReadyEvent {
  pid: number;
}

export interface IProcessExitEvent {
  exitCode: number;
  signal?: number;
}
