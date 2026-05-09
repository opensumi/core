import { Disposable, Emitter } from '@opensumi/ide-core-common';
import { DebugSession } from '@opensumi/ide-debug/lib/browser/debug-session';

import type { DebugSessionOptions } from '@opensumi/ide-debug/lib/common';
import type { TerminalOptions } from '@opensumi/ide-terminal-next';

class TestDebugSession extends DebugSession {
  public async runInTerminalForTest(options: TerminalOptions) {
    return this.doRunInTerminal(options);
  }
}

const createSession = (terminalService: any) => {
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
  return new TestDebugSession(
    'session-1',
    options,
    connection as any,
    terminalService,
    {} as any,
    breakpointManager as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
};

describe('DebugSession runInTerminal', () => {
  it('replaces invalid active terminal with a new one', async () => {
    const terminalClient = { id: 't2', show: jest.fn() };
    const terminalService = {
      terminals: [{ id: 't1', name: 'debug', isActive: true }],
      getDefaultShellPath: jest.fn(async () => '/bin/bash'),
      getProcessId: jest.fn(async (id: string) => (id === 't1' ? -1 : 123)),
      createTerminal: jest.fn(async () => terminalClient),
      sendText: jest.fn(),
      removeTerm: jest.fn(),
    };
    const session = createSession(terminalService);

    await session.runInTerminalForTest({ name: 'debug', cwd: '/tmp', args: ['-c', 'echo test'], env: {} });

    expect(terminalService.removeTerm).toHaveBeenCalledWith('t1');
    expect(terminalService.createTerminal).toHaveBeenCalledTimes(1);
    expect(terminalService.sendText).toHaveBeenCalledWith('t2', expect.any(String));
  });

  it('removes newly created terminal when pid is invalid', async () => {
    const terminalClient = { id: 't2', show: jest.fn() };
    const terminalService = {
      terminals: [],
      getDefaultShellPath: jest.fn(async () => '/bin/bash'),
      getProcessId: jest.fn(async () => -1),
      createTerminal: jest.fn(async () => terminalClient),
      sendText: jest.fn(),
      removeTerm: jest.fn(),
    };
    const session = createSession(terminalService);

    await session.runInTerminalForTest({ name: 'debug', cwd: '/tmp', args: ['-c', 'echo test'], env: {} });

    expect(terminalService.removeTerm).toHaveBeenCalledWith('t2');
  });
});
