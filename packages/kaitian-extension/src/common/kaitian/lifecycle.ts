import { ExtensionCandiDate } from '@ali/ide-core-common';

export interface IMainThreadLifeCycle {
  $setExtensionDir(path: string): void;

  $setExtensionCandidate(candidate: ExtensionCandiDate[]): void;
}

export interface IExtHostLifeCycle {
  setExtensionDir(path: string): void;
  setExtensionCandidate(candidate: ExtensionCandiDate[]): void;
}
