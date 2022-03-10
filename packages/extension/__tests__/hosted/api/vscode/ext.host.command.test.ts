import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { IExtensionInfo, Uri } from '@opensumi/ide-core-common';
import {
  MainThreadAPIIdentifier,
  IMainThreadCommands,
  CommandHandler,
} from '@opensumi/ide-extension/lib/common/vscode';
import * as types from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import { SymbolKind } from '@opensumi/ide-extension/lib/common/vscode/ext-types';
import * as modes from '@opensumi/ide-extension/lib/common/vscode/model.api';
import {
  ExtHostCommands,
  createCommandsApiFactory,
} from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.command';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';

import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';


describe('extension/__tests__/hosted/api/vscode/ext.host.command.test.ts', () => {
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
        handler: async () => 'bingo!',
      },
    },
    {
      id: 'test:builtinCommand:unpermitted',
      handler: {
        handler: () => 'You shall not pass!',
        isPermitted: (extensionInfo: IExtensionInfo) => false,
      },
    },
    {
      id: 'test:builtinCommand:permitted',
      handler: {
        handler: () => 'permitted!',
        isPermitted: (extensionInfo: IExtensionInfo) => true,
      },
    },
  ];

  const rpcProtocol: IRPCProtocol = {
    getProxy: (key) => map.get(key),
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
      expect(vscodeCommand.executeCommand(commandId)).rejects.toThrowError(
        new Error(`Extension vscode.vim has not permit to execute ${commandId}`),
      );
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
      const extTest = jest.fn(function (this: any) {
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
      expect(() => vscodeCommand.executeCommand(commandId)).rejects.toThrowError(
        new Error(`Extension vscode.vim has not permit to execute ${commandId}`),
      );
    });

    it('execute a builtin command with permitted', async () => {
      extCommand.$registerBuiltInCommands();
      const commandId = 'test:builtinCommand:permitted';
      const result = await vscodeCommand.executeCommand(commandId);
      expect(result).toBe('permitted!');
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
      expect(extCommand.$executeCommandWithExtensionInfo(commandShouldAuth, extensionInfo)).rejects.toThrowError(
        new Error('not permitted'),
      );
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
      expect(extCommand.$executeCommandWithExtensionInfo(commandId, extensionInfo)).rejects.toThrowError(
        new Error(`Extension vscode.vim has not permit to execute ${commandId}`),
      );
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

  describe('vscode builtin command', () => {
    let mockMainThreadFunc;
    beforeEach(async () => {
      mockMainThreadFunc = jest.spyOn(mainService, '$executeCommand');
      await extCommand.$registerBuiltInCommands();
      await extCommand.$registerCommandConverter();
    });

    it('vscode.executeFormatDocumentProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeFormatDocumentProvider', file);
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeFormatDocumentProvider');
    });
    it('vscode.executeFormatRangeProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeFormatRangeProvider', file, new types.Range(1, 1, 1, 1));
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeFormatRangeProvider');
    });
    it('vscode.executeFormatOnTypeProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeFormatOnTypeProvider', file, new types.Position(1, 1), '');
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeFormatOnTypeProvider');
    });
    it('vscode.executeDefinitionProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeDefinitionProvider', file, new types.Position(1, 1));
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeDefinitionProvider');
    });
    it('vscode.executeTypeDefinitionProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeTypeDefinitionProvider', file, new types.Position(1, 1));
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeTypeDefinitionProvider');
    });
    it('vscode.executeDeclarationProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeDeclarationProvider', file, new types.Position(1, 1));
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeDeclarationProvider');
    });
    it('vscode.executeDeclarationProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeDeclarationProvider', file, new types.Position(1, 1));
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeDeclarationProvider');
    });
    it('vscode.executeImplementationProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeImplementationProvider', file, new types.Position(1, 1));
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeImplementationProvider');
    });
    it('vscode.executeReferenceProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeReferenceProvider', file, new types.Position(1, 1), []);
      expect(mainService.$executeCommand).toBeCalledWith('_executeReferenceProvider', expect.anything(), {
        column: 2,
        lineNumber: 2,
      });
    });
    it('vscode.executeHoverProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeHoverProvider', file, new types.Position(1, 1));
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeHoverProvider');
    });
    it('vscode.executeSelectionRangeProvider', async () => {
      const file = Uri.file('/a.txt');
      mockMainThreadFunc.mockReturnValueOnce(Promise.resolve([[new Range(1, 1, 1, 1)]]));
      await extCommand.executeCommand('vscode.executeSelectionRangeProvider', file, [new types.Position(1, 1)]);
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeSelectionRangeProvider');
    });
    it('vscode.executeWorkspaceSymbolProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeWorkspaceSymbolProvider', file.toString());
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeWorkspaceSymbolProvider');
    });
    it('vscode.prepareCallHierarchy', async () => {
      const file = Uri.file('/a.txt');
      const resultItem = {
        _sessionId: '',
        _itemId: '',
        kind: SymbolKind.Class,
        name: 'test',
        uri: Uri.file('/a.txt'),
        range: new Range(1, 1, 1, 1),
        selectionRange: new Range(1, 1, 1, 1),
      } as modes.ICallHierarchyItemDto;
      mockMainThreadFunc.mockReturnValueOnce(Promise.resolve([resultItem]));
      const result = await extCommand.executeCommand<vscode.CallHierarchyItem[]>(
        'vscode.prepareCallHierarchy',
        file,
        new types.Position(1, 1),
      );
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executePrepareCallHierarchy');
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('test');
    });
    it('vscode.provideIncomingCalls', async () => {
      const item = new types.CallHierarchyItem(
        types.SymbolKind.Class,
        'test',
        'test',
        Uri.file('/a.txt'),
        new types.Range(1, 1, 1, 1),
        new types.Range(1, 1, 1, 1),
      );
      const resultItem = {
        fromRanges: [new Range(1, 1, 1, 1)],
        from: {
          _sessionId: '',
          _itemId: '',
          kind: SymbolKind.Class,
          name: 'test',
          uri: Uri.file('/a.txt'),
          range: new Range(1, 1, 1, 1),
          selectionRange: new Range(1, 1, 1, 1),
        },
      } as modes.IIncomingCallDto;
      mockMainThreadFunc.mockReturnValueOnce(Promise.resolve([resultItem]));
      const result = await extCommand.executeCommand<vscode.CallHierarchyIncomingCall[]>(
        'vscode.provideIncomingCalls',
        item,
      );
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeProvideIncomingCalls');
      expect(result.length).toBe(1);
      expect(result[0].from.name).toBe('test');
    });
    it('vscode.provideOutgoingCalls', async () => {
      const item = new types.CallHierarchyItem(
        types.SymbolKind.Class,
        'test',
        'test',
        Uri.file('/a.txt'),
        new types.Range(1, 1, 1, 1),
        new types.Range(1, 1, 1, 1),
      );
      const resultItem = {
        fromRanges: [new Range(1, 1, 1, 1)],
        to: {
          _sessionId: '',
          _itemId: '',
          kind: SymbolKind.Class,
          name: 'test',
          uri: Uri.file('/a.txt'),
          range: new Range(1, 1, 1, 1),
          selectionRange: new Range(1, 1, 1, 1),
        },
      } as modes.IOutgoingCallDto;
      mockMainThreadFunc.mockReturnValueOnce(Promise.resolve([resultItem]));
      const result = await extCommand.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
        'vscode.provideOutgoingCalls',
        item,
      );
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeProvideOutgoingCalls');
      expect(result.length).toBe(1);
      expect(result[0].to.name).toBe('test');
    });
    it('vscode.executeDocumentRenameProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeDocumentRenameProvider', file, new types.Position(1, 1), 'b.txt');
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeDocumentRenameProvider');
    });
    it('vscode.executeLinkProvider', async () => {
      const file = Uri.file('/a.txt');
      mockMainThreadFunc.mockReturnValueOnce(Promise.resolve([]));
      await extCommand.executeCommand('vscode.executeLinkProvider', file, 1);
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeLinkProvider');
    });
    it('vscode.executeCompletionItemProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand(
        'vscode.executeCompletionItemProvider',
        file,
        new types.Position(1, 1),
        'triggerCharacter',
        1,
      );
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeCompletionItemProvider');
    });
    it('vscode.executeSignatureHelpProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand(
        'vscode.executeSignatureHelpProvider',
        file,
        new types.Position(1, 1),
        'triggerCharacter',
      );
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeSignatureHelpProvider');
    });
    it('vscode.executeCodeLensProvider', async () => {
      const file = Uri.file('/a.txt');
      await extCommand.executeCommand('vscode.executeCodeLensProvider', file, 1);
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeCodeLensProvider');
    });
    it('vscode.executeCodeActionProvider', async () => {
      const file = Uri.file('/a.txt');
      mockMainThreadFunc.mockReturnValueOnce(Promise.resolve([]));
      await extCommand.executeCommand('vscode.executeCodeActionProvider', file, new types.Range(1, 1, 1, 1), 'kind', 1);
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeCodeActionProvider');
    });
    it('vscode.executeDocumentColorProvider', async () => {
      const file = Uri.file('/a.txt');
      mockMainThreadFunc.mockReturnValueOnce(Promise.resolve([]));
      await extCommand.executeCommand('vscode.executeDocumentColorProvider', file);
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeDocumentColorProvider');
    });
    it('vscode.executeColorPresentationProvider', async () => {
      const file = Uri.file('/a.txt');
      mockMainThreadFunc.mockReturnValueOnce(Promise.resolve([]));
      await extCommand.executeCommand('vscode.executeColorPresentationProvider', new types.Color(0, 0, 0, 0), {
        uri: file,
        range: new types.Range(1, 1, 1, 1),
      });
      expect(mockMainThreadFunc.mock.calls[0][0]).toBe('_executeColorPresentationProvider');
    });
  });
});
