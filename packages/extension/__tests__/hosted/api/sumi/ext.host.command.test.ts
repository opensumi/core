import { ExtHostCommands } from '@ide-framework/ide-extension/lib/hosted/api/vscode/ext.host.command';
import { createCommandsApiFactory } from '@ide-framework/ide-extension/lib/hosted/api/sumi/ext.host.command';
import { IRPCProtocol } from '@ide-framework/ide-connection';
import { MainThreadAPIIdentifier, IMainThreadCommands } from '@ide-framework/ide-extension/lib/common/vscode';
import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';

describe('extension/__tests__/hosted/api/sumi/ext.host.command.test.ts', () => {
  let kaitianCommand;
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
    mainService = mockService({
    });
    const editorService = mockService({});
    const extension = mockService({
      id: 'vscode.vim',
      extensionId: 'cloud-ide.vim',
      isBuiltin: false,
    });
    rpcProtocol.set(MainThreadAPIIdentifier.MainThreadCommands, mainService);
    extCommand = new ExtHostCommands(rpcProtocol);
    kaitianCommand = createCommandsApiFactory(extCommand, editorService, extension);
  });

  describe('kaitian api command', () => {
    it('execute a not allow command', async () => {
      const extTest = jest.fn();
      const commandId = 'ext.test';
      kaitianCommand.registerCommandWithPermit(commandId, extTest, (extension) => extension.isBuiltin);
      expect(kaitianCommand.executeCommand(commandId)).rejects.toThrowError(new Error(`Extension vscode.vim has not permit to execute ${commandId}`));
      // 实际命令执行注册一次
      expect(extTest).toBeCalledTimes(0);
    });

    it('execute a allow command', async () => {
      const extTest = jest.fn();
      const commandId = 'ext.test';
      kaitianCommand.registerCommandWithPermit(commandId, extTest, (extension) => !extension.isBuiltin);
      await kaitianCommand.executeCommand(commandId);
      // 实际命令执行注册一次
      expect(extTest).toBeCalledTimes(1);
    });
  });

});
