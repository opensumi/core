import { CancellationToken } from '@ali/vscode-jsonrpc';
import { UriComponents } from 'vscode-uri';

export class CommonCls {
  add(a: number, b: number) {
    return a + b;
  }
}

export interface IExtHostSCMShape {
  $provideOriginalResource(sourceControlHandle: number, uri: UriComponents, token: CancellationToken): Promise<UriComponents | null>;
  $onInputBoxValueChange(sourceControlHandle: number, value: string): void;
  $executeResourceCommand(sourceControlHandle: number, groupHandle: number, handle: number): Promise<void>;
  $validateInput(sourceControlHandle: number, value: string, cursorPosition: number): Promise<[string, number] | undefined>;
  $setSelectedSourceControls(selectedSourceControlHandles: number[]): Promise<void>;
}

export * from './scm.service';
export * from './scm';
