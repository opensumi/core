import { ExtHostCommands, CommandsConverter } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.command';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IMainThreadCommands } from '@ali/ide-kaitian-extension/lib/common/vscode';
import { mockService } from '../../../../tools/dev-tool/src/mock-injector';

describe('ExtHostCommand', () => {
  let extCommand: ExtHostCommands;
  let mainService: IMainThreadCommands;
  const map = new Map();
  const rpcProtocol: IRPCProtocol = {
    getProxy: (key) => {
      return map.get(key);
    },
    set: (key, value) => {
      map.set(key, value);
      return value;
    },
    get: (r) => map.get(r),
  };

  beforeEach(() => {
    mainService = mockService({});
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, mainService);
    extCommand = new ExtHostCommands(rpcProtocol);
  });

  it('register a command', () => {
    const extTest = jest.fn();
    const commandId = 'ext.test';
    extCommand.registerCommand(true, commandId, extTest);
    // 远端注册被调用一次
    expect(mainService.$registerCommand).toBeCalledTimes(1);
    extCommand.executeCommand(commandId);
    // 实际命令执行注册一次
    expect(extTest).toBeCalledTimes(1);
  });

  it('throw error when register exist command', () => {
    const extTest = jest.fn();
    const commandId = 'ext.test';
    extCommand.registerCommand(true, commandId, extTest);
    // 再注册一次
    expect(() => extCommand.registerCommand(true, commandId, extTest)).toThrowError();
  });

  it('register a command with thisArg', async () => {
    const commandId = 'ext.test';
    const thisArg = {};
    // https://github.com/Microsoft/TypeScript/issues/16016#issuecomment-303462193
    const extTest = jest.fn(function(this: any) {
      return this;
    });
    extCommand.registerCommand(true, commandId, extTest, thisArg);
    const thisArgResult = await extCommand.executeCommand(commandId);
    expect(thisArgResult === thisArg).toBeTruthy();
  });

  it('register a command without global', () => {
    const extTest = jest.fn();
    const commandId = 'ext.test';
    extCommand.registerCommand(false, commandId, extTest);
    // 如果 global 设置为 false，则不会执行远端命令注册
    expect(mainService.$registerCommand).toBeCalledTimes(0);
  });

  it('execute a command', () => {
    const extTest = jest.fn();
    const commandId = 'ext.test';
    extCommand.registerCommand(false, commandId, extTest);
    extCommand.executeCommand(commandId);
    // 本地有命令的，远端不会执行
    expect(mainService.$executeCommand).toBeCalledTimes(0);
  });

  it('execute a command then localCommand not found', () => {
    const commandId = 'ext.notfound';
    extCommand.executeCommand(commandId);
    // 本地找不到会到远端找
    expect(mainService.$executeCommand).toBeCalledTimes(1);
  });

  it('dispose calls unregister', async () => {
    const extTest = jest.fn();
    const command = extCommand.registerCommand(true, 'ext.test', extTest);
    command.dispose();
    // 卸载远端命令
    expect(mainService.$unregisterCommand).toBeCalledTimes(1);
  });

  it('call getCommands', async () => {
    await extCommand.getCommands();
    expect(mainService.$getCommands).toBeCalledTimes(1);
  });

  it('register builtin commands', async () => {
    extCommand.$registerBuiltInCommands();
    expect(extCommand.converter instanceof CommandsConverter).toBeTruthy();
    // extCommand.executeCommand('vscode.executeReferenceProvider');
    // 说明已经注册成功，本地有命令的，所以远端不会执行
    expect(mainService.$executeCommand).toBeCalledTimes(0);
  });

  it('call $executeContributedCommand with exist command', async () => {
    const extTest = jest.fn();
    const commandId = 'ext.test';
    extCommand.registerCommand(true, commandId, extTest);
    await extCommand.$executeContributedCommand(commandId);
    expect(extTest).toBeCalledTimes(1);
  });

  it('call $executeContributedCommand with no-exist command', () => {
    const commandId = 'ext.notfound';
    expect(extCommand.$executeContributedCommand(commandId)).rejects.toThrowError();
  });

  it('register argument processor', async () => {
    const argumentProcessor = {
      processArgument: jest.fn(),
    };
    extCommand.registerArgumentProcessor(argumentProcessor);
    const extTest = jest.fn();
    const commandId = 'ext.test';
    extCommand.registerCommand(true, commandId, extTest);
    await extCommand.$executeContributedCommand(commandId, '123');
    expect(argumentProcessor.processArgument).toBeCalledTimes(1);
  });
});
