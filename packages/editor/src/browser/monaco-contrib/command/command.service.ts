import { Injectable, Autowired } from '@ali/common-di';
import { Command, Emitter, CommandRegistry, CommandHandler, ILogger, EDITOR_COMMANDS, CommandService, isElectronRenderer, IReporterService, REPORT_NAME, ServiceNames, memoize, Uri, MonacoOverrideServiceRegistry } from '@ali/ide-core-browser';

import { CommandsRegistry as MonacoCommandsRegistry, EditorExtensionsRegistry, ICommandEvent, ICommandService, IMonacoActionRegistry, IMonacoCommandService, IMonacoCommandsRegistry, MonacoEditorCommandHandler } from '@ali/ide-monaco/lib/browser/contrib/command';
import { StaticServices } from '@ali/ide-monaco/lib/browser/monaco-api/services';
import { Event, ICodeEditor, IEvent } from '@ali/ide-monaco/lib/browser/monaco-api/types';
import { EditorCollectionService, WorkbenchEditorService } from '../../types';

/**
 * vscode 会有一些别名 command，如果直接执行这些别名 command 会报错，做一个转换
 */
const MonacoCommandAlias = {
  'editor.action.smartSelect.grow': 'editor.action.smartSelect.expand',
  'cursorWordPartStartLeft': 'cursorWordPartLeft',
  'cursorWordPartStartLeftSelect': 'cursorWordPartLeftSelect',
  'editor.action.previewDeclaration': 'editor.action.peekDefinition',
  'editor.action.openDeclarationToTheSide': 'editor.action.revealDefinitionAside',
  'editor.action.goToDeclaration': 'editor.action.revealDefinition',
};

/**
 * monaco 命令分两种
 *  一种命令不需要带参数，是封装过的命令，即为 action
 * 一种是正常命令，执行可以带参数
 */
export enum MonacoCommandType {
  ACTION,
  COMMAND,
}

export type MonacoCommand = Command & { type: MonacoCommandType };

@Injectable()
export class MonacoCommandService implements IMonacoCommandService {
  _serviceBrand: undefined;

  // TODO - Monaco 20 - ESM
  onDidExecuteCommand: Event<ICommandEvent>;

  private delegate: ICommandService;
  /**
   * 事件触发器，在执行命令的时候会触发
   * @type {Emitter<ICommandEvent>}
   * @memberof MonacoCommandService
   */
  _onWillExecuteCommand: Emitter<ICommandEvent> = new Emitter<ICommandEvent>();

  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(IReporterService)
  reporterService: IReporterService;

  /**
   * 设置委托对象
   * @param delegate 真正要执行 monaco 内部 command 的 commandSerice
   */
  setDelegate(delegate: ICommandService) {
    this.delegate = delegate;
  }

  get onWillExecuteCommand(): IEvent<ICommandEvent> {
    return this._onWillExecuteCommand.event;
  }

  /**
   * 执行命令
   * 先去全局 commands 里找，若没有尝试执行 delegate 的 command
   * @param commandId
   * @param args
   */
  executeCommand<T>(commandId: string, ...args: any[]): Promise<T | undefined> {
    this.logger.debug('command: ' + commandId);
    this._onWillExecuteCommand.fire({ commandId, args });
    const handler = this.commandRegistry.getActiveHandler(commandId, ...args);
    if (handler) {
      try {
        return this.commandService.executeCommand(commandId, ...args);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    if (this.delegate) {
      return this.delegate.executeCommand(MonacoCommandAlias[commandId] ? MonacoCommandAlias[commandId] : commandId, ...args);
    }
    this.reporterService.point(REPORT_NAME.NOT_FOUND_COMMAND, commandId);
    return Promise.reject(new Error(`command '${commandId}' not found`));
  }
}

@Injectable()
export class MonacoCommandRegistry implements IMonacoCommandsRegistry {

  @Autowired(CommandRegistry)
  private commands: CommandRegistry;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorService;

  @Autowired(EditorCollectionService)
  private editorCollectionService: EditorCollectionService;

  /**
   * 校验 command id 是否是 monaco id
   * @param command 要校验的 id
   * @returns 若找到则为转换过 monaco id，否则为 undefined
   */
  validate(command: string): string | undefined {
    return this.commands.getRawCommand(command)?.id;
  }

  /**
   * 注册 monaco 命令
   * 命令 id 会统一加入 manaco 前缀
   * monaco handler 会注入当前 editor 参数
   * @param command 注册的命令
   * @param handler 命令处理函数
   */
  registerCommand(command: Command, handler: MonacoEditorCommandHandler): void {
    this.commands.registerCommand(command, this.newHandler(handler));
  }

  /**
   * 注册处理函数函数
   * monaco handler 会注入当前 editor 参数
   * @param command 命令 id
   * @param handler 命令处理函数
   */
  registerHandler(commandID: string, handler: MonacoEditorCommandHandler): void {
    this.commands.registerHandler(commandID, this.newHandler(handler));
  }

  /**
   * 包装 monaco 命令处理函数为内部处理函数
   * @param monacoHandler 要处理的 monaco 命令处理函数
   */
  protected newHandler(monacoHandler: MonacoEditorCommandHandler): CommandHandler {
    return {
      execute: (...args) => this.execute(monacoHandler, ...args),
      isEnabled: (...args) => this.isEnabled(monacoHandler, ...args),
    };
  }

  /**
   * 给 monacoHandler 传递 editor 参数
   * @param monacoHandler 要处理的 monaco 命令函数
   * @param args 要透传的参数
   */
  protected execute(monacoHandler: MonacoEditorCommandHandler, ...args: any[]): any {
    const editor = this.getActiveCodeEditor();
    if (editor) {
      // editor.focus();
      return Promise.resolve(monacoHandler.execute(editor, ...args));
    }
    return Promise.resolve();
  }

  /**
   * 是否开启该命令
   * 如果没有 editor 则为 false
   * 否则尝试执行函数的 isEnabled 方法
   * @param monacoHandler
   * @param args
   */
  protected isEnabled(monacoHandler: MonacoEditorCommandHandler, ...args: any[]): boolean {
    if (isElectronRenderer()) {
      // 针对 Selection 等菜单在 electron 上的展示
      return true;
    }
    const editor = this.getActiveCodeEditor();
    return !!editor && (!monacoHandler.isEnabled || monacoHandler.isEnabled(editor, ...args));
  }

  /**
   * 获取当前活动的编辑器
   * 此处的活动编辑器和 workbenchEditorService.currentEditor 的概念不同，对于diffEditor，需要获取确实的那个editor而不是modifiedEditor
   */
  protected getActiveCodeEditor(): ICodeEditor | undefined {
    // 先从editor-collection的焦点追踪，contextMenu追踪中取
    if (this.editorCollectionService.currentEditor) {
      return this.editorCollectionService.currentEditor.monacoEditor;
    }

    // 使用当前 editorGroup.editor 兜底
    const editorGroup = this.workbenchEditorService.currentEditorGroup;
    if (editorGroup) {
      const editor = editorGroup.currentFocusedEditor || editorGroup.currentEditor;
      if (editor) {
        return editor.monacoEditor;
      }
    }
  }
}

@Injectable()
export class MonacoActionRegistry implements IMonacoActionRegistry {

  private static COMMON_ACTIONS = new Map<string, string>( [
    ['undo', EDITOR_COMMANDS.UNDO.id],
    ['redo', EDITOR_COMMANDS.REDO.id],
    ['editor.action.selectAll', EDITOR_COMMANDS.SELECT_ALL.id],
  ]);

  private static CONVERT_MONACO_COMMAND_ARGS = new Map<string, (...args: any[]) => any[]>([
    [
      'editor.action.showReferences', (uri, ...args) => [Uri.parse(uri), ...args],
    ],
  ]);

  /**
   * 要排除注册的 Action
   *
   * @protected
   * @memberof MonacoActionModule
   */
  protected static readonly EXCLUDE_ACTIONS = [
    'setContext',
    'editor.action.quickCommand',
    'editor.action.toggleHighContrast',
  ];

  @Autowired()
  monacoCommandRegistry: MonacoCommandRegistry;

  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServiceRegistry: MonacoOverrideServiceRegistry;

  @memoize
  get globalInstantiationService() {
    const codeEditorService = this.overrideServiceRegistry.getRegisteredService(ServiceNames.CODE_EDITOR_SERVICE);
    const textModelService = this.overrideServiceRegistry.getRegisteredService(ServiceNames.TEXT_MODEL_SERVICE);
    const contextKeyService = this.overrideServiceRegistry.getRegisteredService(ServiceNames.CONTEXT_KEY_SERVICE);
    const [, globalInstantiationService] = StaticServices.init({
      codeEditorService,
      textModelService,
      contextKeyService,
    });
    return globalInstantiationService;
  }

  @memoize
  get monacoEditorRegistry() {
    return EditorExtensionsRegistry;
  }

  @memoize
  get monacoCommands() {
    return MonacoCommandsRegistry.getCommands();
  }

  registerMonacoActions() {
    const editorActions = new Map(this.monacoEditorRegistry.getEditorActions().map(({ id, label }) => [id, label]));
    for (const id of this.monacoCommands.keys()) {
      if (MonacoActionRegistry.EXCLUDE_ACTIONS.includes(id)) {
        continue;
      }
      const label = editorActions.has(id) ? editorActions.get(id) : '';
      const handler = editorActions.has(id) ? this.newActionHandler(id) : this.newCommandHandler(id);
      this.monacoCommandRegistry.registerCommand({
        id,
        label,
      }, handler);
      // 将 monaco 命令处理函数代理到有 label 的空命令上
      const command = MonacoActionRegistry.COMMON_ACTIONS.get(id);
      if (command) {
        this.monacoCommandRegistry.registerHandler(command, handler);
      }
    }
  }

  /**
   * 是否是 _execute 开头的 monaco 命令
   */
  private isInternalExecuteCommand(commandId: string) {
    return commandId.startsWith('_execute');
  }

  /**
   * monaco 内部会判断 uri 执行是否是 Uri 实例，执行改类命令统一转换一下
   * @param args
   */
  private processInternalCommandArgument(commandId: string, args: any[] = []): any[] {
    if (this.isInternalExecuteCommand(commandId)) {
      return args.map((arg) => arg instanceof Uri ? Uri.revive(arg) : arg);
    } else if (MonacoActionRegistry.CONVERT_MONACO_COMMAND_ARGS.has(commandId)) {
      return MonacoActionRegistry.CONVERT_MONACO_COMMAND_ARGS.get(commandId)!(...args);
    }
    return args;
  }

  /**
   * 调用 monaco 内部 _commandService 执行命令
   * 实际执行的就是 MonacoCommandService
   * @param commandId 命令名称
   */
  protected newCommandHandler(commandId: string): MonacoEditorCommandHandler {
    return {
      execute: (editor, ...args) => {
        const editorCommand = !!this.monacoEditorRegistry.getEditorCommand(commandId) ||
          !(this.isInternalExecuteCommand(commandId) || commandId === 'setContext' || MonacoActionRegistry.COMMON_ACTIONS.has(commandId));
        const instantiationService = editorCommand ? editor && editor['_instantiationService'] : this.globalInstantiationService;
        if (!instantiationService) {
          return;
        }
        const commandArgs = this.processInternalCommandArgument(commandId, args);
        return instantiationService.invokeFunction(
          this.monacoCommands.get(commandId)?.handler,
          ...commandArgs,
        );
      },
      isEnabled: (editor) => {
        if (!!this.monacoEditorRegistry.getEditorCommand(commandId)) {
          return !!editor;
        }
        return true;
      },
    };
  }

  /**
   * 包装 action 为命令处理函数
   * 调用 getAction 执行 run 命令
   * @param id action id
   */
  protected newActionHandler(id: string): MonacoEditorCommandHandler {
    return {
      execute: (editor) => this.runAction(id, editor),

      isEnabled: (editor) => {
        const action = editor.getAction(id);
        return !!action;
      },
    };
  }

  /**
   * 执行 action
   * @param id 要执行的 action
   * @param editor 执行 action 的 editor，默认为当前 editor
   */
  protected runAction(id: string, editor: ICodeEditor): Promise<void> {
    if (editor) {
      const action = editor.getAction(id);
      if (action) {
        return action.run();
      }
    }

    return Promise.resolve();
  }

  /**
   * 生成键盘处理函数
   * @param action 对应 action
   */
  protected newKeyboardHandler(action: string): MonacoEditorCommandHandler {
    return {
      execute: (editor, ...args) => editor.trigger('keyboard', action, args),
    };
  }
}
