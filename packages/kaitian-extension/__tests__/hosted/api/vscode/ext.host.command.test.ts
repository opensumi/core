import { ExtHostCommands, CommandsConverter, createCommandsApiFactory } from '@ali/ide-kaitian-extension/lib/hosted/api/vscode/ext.host.command';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IMainThreadCommands, CommandHandler } from '@ali/ide-kaitian-extension/lib/common/vscode';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';
import { IExtensionInfo } from '@ali/ide-core-common';
import { Uri } from '@ali/ide-core-common';
import * as types from '@ali/ide-kaitian-extension/lib/common/vscode/ext-types';
import type * as vscode from 'vscode';

describe('kaitian-extension/__tests__/hosted/api/vscode/ext.host.command.test.ts', () => {
  let vscodeCommand: typeof vscode.commands;
  let extCommand: ExtHostCommands;
  let mainService: IMainThreadCommands;
  const commandShouldAuth = 'ext.commandShouldAuthId';
  // mock 判断是否有权限是根据是否为内置函数
  const isPermitted = (extensionInfo: IExtensionInfo) => extensionInfo.isBuiltin;
  const map = new Map();
  const builtinCommands = [
    {
      id: 'test:builtinCommand',
      handler: {
        handler: async () => {
          return 'bingo!';
        },
      },
    },
    {
      id: 'test:builtinCommand:unpermitted',
      handler: {
        handler: () => {
          return 'You shall not pass!';
        },
        isPermitted: (extensionInfo: IExtensionInfo) => {
          return false;
        },
      },
    },
    {
      id: 'test:builtinCommand:permitted',
      handler: {
        handler: () => {
          return 'permitted!';
        },
        isPermitted: (extensionInfo: IExtensionInfo) => {
          return true;
        },
      },
    },
  ];

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
    mainService = mockService({
      $executeCommandWithExtensionInfo: jest.fn((id: string, extensionInfo: IExtensionInfo) => {
        // 模拟鉴权函数是为判断是否为内置函数
        if (id === commandShouldAuth && !isPermitted(extensionInfo)) {
          throw new Error('not permitted');
        }
        return Promise.resolve(true);
      }),
      $executeCommand: jest.fn(() => Promise.resolve()),
      $executeReferenceProvider: jest.fn(() => Promise.resolve({
        uri: Uri.parse(''),
        range: new types.Range(1, 1, 1, 1),
      })),
    });
    const editorService = mockService({});
    const extension = mockService({
      id: 'vscode.vim',
      extensionId: 'cloud-ide.vim',
      isBuiltin: false,
    });
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, mainService);
    extCommand = new ExtHostCommands(rpcProtocol, builtinCommands);
    vscodeCommand = createCommandsApiFactory(extCommand, editorService, extension);
  });

  describe('vscode command', () => {
    it('execute a command', async () => {
      const extTest = jest.fn();
      const commandId = 'ext.test';
      vscodeCommand.registerCommand(commandId, extTest);
      await vscodeCommand.executeCommand(commandId);
      // 实际命令执行注册一次
      expect(extTest).toBeCalledTimes(1);
    });

    it('execute a no-permitted command', async () => {
      const commandHandler: CommandHandler = {
        handler: jest.fn(() => 123),
        isPermitted: () => false,
      };

      const commandId = 'ext.test';
      extCommand.registerCommand(false, commandId, commandHandler);
      expect(vscodeCommand.executeCommand(commandId)).rejects.toThrowError(new Error(`Extension vscode.vim has not permit to execute ${commandId}`));
      expect(commandHandler.handler).toBeCalledTimes(0);
    });
  });

  describe('ExtHostCommands', () => {
    it('register a command', async () => {
      const extTest = jest.fn();
      const commandId = 'ext.test';
      extCommand.registerCommand(true, commandId, extTest);
      // 远端注册被调用一次
      expect(mainService.$registerCommand).toBeCalledTimes(1);
      await extCommand.executeCommand(commandId);
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

    it('execute a command', async () => {
      const extTest = jest.fn();
      const commandId = 'ext.test';
      extCommand.registerCommand(false, commandId, extTest);
      await extCommand.executeCommand(commandId);
      // 本地有命令的，远端不会执行
      expect(mainService.$executeCommand).toBeCalledTimes(0);
    });

    it('execute a command then localCommand not found', async () => {
      const commandId = 'ext.notfound';
      await extCommand.executeCommand(commandId);
      // 本地找不到会到远端找
      expect(mainService.$executeCommand).toBeCalledTimes(1);
    });

    it('execute a builtin command', async () => {
      extCommand.$registerBuiltInCommands();
      const commandId = 'test:builtinCommand';
      const result = await extCommand.executeCommand(commandId);
      expect(result).toBe('bingo!');
    });

    it('execute a builtin command will not permitted', async () => {
      extCommand.$registerBuiltInCommands();
      const commandId = 'test:builtinCommand:unpermitted';
      expect(() => vscodeCommand.executeCommand(commandId)).rejects.toThrowError(new Error(`Extension vscode.vim has not permit to execute ${commandId}`));
    });

    it('execute a builtin command with permitted', async () => {
      extCommand.$registerBuiltInCommands();
      const commandId = 'test:builtinCommand:permitted';
      const result = await vscodeCommand.executeCommand(commandId);
      expect(result).toBe('permitted!');
    });

    it.skip('builtin command should not be called via mainthread', async () => {
      // TODO 需 mock mainthreadCommand
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
      extCommand.$registerCommandConverter();
      expect(extCommand.converter instanceof CommandsConverter).toBeTruthy();
      await extCommand.executeCommand('vscode.executeReferenceProvider', Uri.parse(''), new types.Position(1, 1), []);
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

    it('execute requiring authentication command to frontend command when permitted', async () => {
      const extensionInfo: IExtensionInfo = {
        id: 'vscode.vim',
        extensionId: 'cloud-ide.vim',
        isBuiltin: true,
      };
      expect(await extCommand.$executeCommandWithExtensionInfo(commandShouldAuth, extensionInfo)).toBeTruthy();
    });

    it('execute requiring authentication command to frontend command when not permitted', () => {
      const extensionInfo: IExtensionInfo = {
        id: 'vscode.vim',
        extensionId: 'cloud-ide.vim',
        isBuiltin: false,
      };
      expect(extCommand.$executeCommandWithExtensionInfo(commandShouldAuth, extensionInfo)).rejects.toThrowError(new Error('not permitted'));
    });

    it('execute requiring authentication command to local command when not permitted', async () => {
      const commandId = 'ext.test';
      const extensionInfo: IExtensionInfo = {
        id: 'vscode.vim',
        extensionId: 'cloud-ide.vim',
        isBuiltin: false,
      };
      const commandHandler: CommandHandler = {
        handler: jest.fn(() => 123),
        isPermitted: () => false,
      };
      extCommand.registerCommand(false, commandId, commandHandler);
      expect(extCommand.$executeCommandWithExtensionInfo(commandId, extensionInfo)).rejects.toThrowError(new Error(`Extension vscode.vim has not permit to execute ${commandId}`));
    });

    it('execute requiring authentication command to local command when permitted', async () => {
      const commandId = 'ext.test';
      const extensionInfo: IExtensionInfo = {
        id: 'vscode.vim',
        extensionId: 'cloud-ide.vim',
        isBuiltin: true,
      };
      const commandHandler: CommandHandler = {
        handler: jest.fn(() => 123),
        isPermitted: (extension) => extension.isBuiltin,
      };
      extCommand.registerCommand(false, commandId, commandHandler);
      expect(await extCommand.$executeCommandWithExtensionInfo(commandId, extensionInfo)).toBe(123);
    });
  });

});
