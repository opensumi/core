import { MonacoOverrideServiceRegistry } from '@opensumi/ide-core-browser';
import { ILoggerManagerClient, Emitter, CommandRegistry } from '@opensumi/ide-core-common';
import { WorkbenchEditorService, EditorCollectionService } from '@opensumi/ide-editor';
import {
  MonacoActionRegistry,
  MonacoCommandRegistry,
  MonacoCommandService,
} from '@opensumi/ide-editor/lib/browser/monaco-contrib/command/command.service';
import {
  EditorAction,
  EditorExtensionsRegistry,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorExtensions';
import { CommandsRegistry, ICommandEvent } from '@opensumi/monaco-editor-core/esm/vs/platform/commands/common/commands';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import MonacoServiceImpl from '../../src/browser/monaco.service';
import { MonacoOverrideServiceRegistryImpl } from '../../src/browser/override.service.registry';
import { MonacoService } from '../../src/common';


describe(' monaco command service test', () => {
  let injector: MockInjector;
  let commandRegistry: CommandRegistry;
  let monacoCommandRegistry: MonacoCommandRegistry;
  let monacoCommandService: MonacoCommandService;
  let monacoActionRegistry: MonacoActionRegistry;
  const monacoEditor = {};

  beforeAll(async () => {
    injector = createBrowserInjector([]);

    injector.addProviders(
      {
        token: MonacoService,
        useClass: MonacoServiceImpl,
      },
      {
        token: MonacoOverrideServiceRegistry,
        useClass: MonacoOverrideServiceRegistryImpl,
      },
      {
        token: EditorCollectionService,
        useValue: {
          currentEditor: {
            monacoEditor,
          },
        },
      },
      {
        token: WorkbenchEditorService,
        useValue: {},
      },
      {
        token: ILoggerManagerClient,
        useValue: {
          getLogger: () => ({
            log() {},
            debug() {},
            error() {},
            verbose() {},
            warn() {},
          }),
        },
      },
    );
    commandRegistry = injector.get(CommandRegistry);
    const service: MonacoService = injector.get(MonacoService);
    await service.loadMonaco();
    monacoCommandRegistry = injector.get(MonacoCommandRegistry);
    monacoCommandService = injector.get(MonacoCommandService);
    monacoActionRegistry = injector.get(MonacoActionRegistry);
    EditorExtensionsRegistry['getEditorActions'] = () =>
      [
        {
          id: 'editor.action.cut',
          label: '剪切',
          alias: 'cut',
        },
      ] as unknown as EditorAction[];

    const commands = new Map();
    commands.set('replacePreviousChar', {});
    commands.set('editor.action.cut', {});
    CommandsRegistry['getCommands'] = () => commands;
  });

  describe('monaco command service', () => {
    it('execute commandRegistry command', async () => {
      const id = 'command.core.test';
      const execute = jest.fn();
      commandRegistry.registerCommand({ id }, { execute });
      await monacoCommandService.executeCommand(id, 123);
      expect(execute).toBeCalledTimes(1);
      expect(execute).toBeCalledWith(123);
    });

    it('execute delegate command', async () => {
      const id = 'monaco.internal.test';
      const executeCommand = jest.fn();
      const onWillExecuteCommandCallBack = jest.fn();
      const _onWillExecuteCommand = new Emitter<ICommandEvent>();
      const _onDidExecuteCommand = new Emitter<ICommandEvent>();
      monacoCommandService.setDelegate({
        _serviceBrand: undefined,
        executeCommand,
        onWillExecuteCommand: _onWillExecuteCommand.event,
        onDidExecuteCommand: _onDidExecuteCommand.event,
      });
      monacoCommandService.onWillExecuteCommand(onWillExecuteCommandCallBack);
      await monacoCommandService.executeCommand(id);
      expect(onWillExecuteCommandCallBack).toBeCalledTimes(1);
      expect(executeCommand).toBeCalledTimes(1);
      expect(executeCommand).toBeCalledWith(id);
    });
  });

  describe('monaco command register', () => {
    it('should be able to register and execute command', async () => {
      const id = 'command.test';
      const execute = jest.fn();
      monacoCommandRegistry.registerCommand(
        {
          id,
        },
        {
          execute,
        },
      );

      await monacoCommandService.executeCommand(id);
      expect(execute).toBeCalledTimes(1);
      // monaco command execute 第一个参数是当前激活的 monaco 实例
      expect(execute).toBeCalledWith(monacoEditor);
    });

    it('should execute second command handler', async () => {
      const id = 'command.handler.test';
      const execute = jest.fn();
      const handlerExecute = jest.fn();
      monacoCommandRegistry.registerCommand(
        {
          id,
        },
        {
          execute,
        },
      );
      monacoCommandRegistry.registerHandler(id, {
        execute: handlerExecute,
      });

      await monacoCommandService.executeCommand(id);
      expect(execute).toBeCalledTimes(0);
      expect(handlerExecute).toBeCalledTimes(1);
    });

    it('validate a command', async () => {
      const id = 'command.validate.test';
      const execute = jest.fn();
      monacoCommandRegistry.registerCommand(
        {
          id,
        },
        {
          execute,
        },
      );

      expect(monacoCommandRegistry.validate(id)).toBe(id);
      expect(monacoCommandRegistry.validate('not-fonund-command')).toBe(undefined);
    });
  });

  describe('monaco action registry', () => {
    it('sync monaco all command', () => {
      monacoActionRegistry.registerMonacoActions();
      // command
      expect(monacoCommandRegistry.validate('replacePreviousChar')).toBe('replacePreviousChar');
      // action
      expect(commandRegistry.getCommand('editor.action.cut')?.label).toBe('剪切');
      // exclude action
      expect(commandRegistry.getCommand('setContext')).toBeUndefined();
    });
  });
});
