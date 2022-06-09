import { Injector } from '@opensumi/di';

import { CoreCommandRegistryImpl } from '../src/command';

describe('command registry', () => {
  it('before hooks can prevent cmd', async () => {
    const injector = new Injector();
    const command = injector.get(CoreCommandRegistryImpl);
    let a;
    let finalArgs;
    command.registerCommand(
      {
        id: 'test',
      },
      {
        execute: (...args) => {
          a = 1;
          finalArgs = args;
          return 'true return';
        },
      },
    );
    command.beforeExecuteCommand('test', () => false);
    command.afterExecuteCommand('test', () => 'modified result');

    const data = await command.executeCommand('test', 'first arg');
    expect(finalArgs).toBe(undefined);
    expect(a).toBe(undefined);
    expect(data).toBe(undefined);
  });
  it('before/after hooks o(1)', async () => {
    const injector = new Injector();
    const command = injector.get(CoreCommandRegistryImpl);
    let a = 0;
    let finalArgs;
    command.registerCommand(
      {
        id: 'test',
      },
      {
        execute: (...args) => {
          a = 1;
          finalArgs = args;
          return 'true return';
        },
      },
    );
    let oldArgs;
    const beforeToDispose = command.beforeExecuteCommand('test', (args) => {
      oldArgs = args;
      return ['a new arg'];
    });
    const toDispose = command.afterExecuteCommand('test', () => 'modified result');

    const data = await command.executeCommand('test', 'first arg');
    expect(oldArgs[0]).toBe('first arg');
    expect(finalArgs[0]).toBe('a new arg');
    expect(a).toBe(1);
    expect(data).toBe('modified result');
    toDispose.dispose();
    const data1 = await command.executeCommand('test', 'first arg');
    expect(data1).toBe('true return');

    oldArgs = undefined;
    beforeToDispose.dispose();
    await command.executeCommand('test', 'first arg');
    expect(oldArgs).toBe(undefined);
  });
  it('before/after hooks o(n)', async () => {
    const injector = new Injector();
    const command = injector.get(CoreCommandRegistryImpl);
    let a = 0;
    let finalArgs;
    command.registerCommand(
      {
        id: 'test',
      },
      {
        execute: (...args) => {
          a++;
          finalArgs = args;
          return 'true return';
        },
      },
    );
    let oldArgs;
    const beforeToDispose = command.beforeExecuteCommand((cmd, args) => {
      oldArgs = args;
      return ['a new arg'];
    });
    const toDispose = command.afterExecuteCommand((cmd) => 'modified result');

    const data = await command.executeCommand('test', 'first arg');
    expect(oldArgs[0]).toBe('first arg');
    expect(finalArgs[0]).toBe('a new arg');
    expect(a).toBe(1);
    expect(data).toBe('modified result');
    toDispose.dispose();
    const data1 = await command.executeCommand('test', 'first arg');
    expect(data1).toBe('true return');

    oldArgs = undefined;
    beforeToDispose.dispose();
    await command.executeCommand('test', 'first arg');
    expect(oldArgs).toBe(undefined);
  });
});
