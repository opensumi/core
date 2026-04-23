import { Disposable, Emitter } from '@opensumi/ide-core-common';
import { DebugSession } from '@opensumi/ide-debug/lib/browser/debug-session';

import type { DebugSessionOptions } from '@opensumi/ide-debug/lib/common';

const createSession = () => {
  const connection = {
    disposed: false,
    onRequest: jest.fn(),
    on: jest.fn(() => Disposable.create(() => {})),
    onDidCustomEvent: new Emitter<any>().event,
    dispose: jest.fn(),
  };
  const breakpointManager = {
    breakpointsEnabled: false,
    onDidChangeBreakpoints: jest.fn(() => Disposable.create(() => {})),
    onDidChangeExceptionsBreakpoints: jest.fn(() => Disposable.create(() => {})),
    clearAllStatus: jest.fn(),
  };
  const options: DebugSessionOptions = {
    configuration: {
      name: 'test',
      type: 'node',
      request: 'launch',
    },
    index: 0,
  };

  return new DebugSession(
    'session-1',
    options,
    connection as any,
    {} as any,
    {} as any,
    breakpointManager as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
};

describe('DebugSession evaluate', () => {
  it('fires variable change for repl evaluation', async () => {
    const session = createSession();
    session.sendRequest = jest.fn().mockResolvedValue({
      body: {
        result: '1',
      },
    });
    const onVariableChange = jest.fn();

    session.onVariableChange(onVariableChange);
    await session.evaluate('t = 1', 'repl');

    expect(onVariableChange).toHaveBeenCalledTimes(1);
  });

  it('does not fire variable change for watch evaluation', async () => {
    const session = createSession();
    session.sendRequest = jest.fn().mockResolvedValue({
      body: {
        result: '1',
      },
    });
    const onVariableChange = jest.fn();

    session.onVariableChange(onVariableChange);
    await session.evaluate('t', 'watch');

    expect(onVariableChange).not.toHaveBeenCalled();
  });
});
