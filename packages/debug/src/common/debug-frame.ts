import type { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

export function isFrameDeemphasized(frame: DebugProtocol.StackFrame): boolean {
  const hint = frame.presentationHint ?? frame.source?.presentationHint;
  return hint === 'deemphasize' || hint === 'subtle';
}
