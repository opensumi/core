import { Injectable, Autowired } from '@ali/common-di';
import { Command, Emitter, CommandRegistry, CommandHandler, ILogger, EDITOR_COMMANDS, localize } from '@ali/ide-core-browser';

import ICommandEvent = monaco.commands.ICommandEvent;
import ICommandService = monaco.commands.ICommandService;
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IMonacoImplEditor } from '@ali/ide-editor/lib/browser/editor-collection.service';
import { SELECT_ALL_COMMAND } from './monaco-menu';

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

/**
 * monaco 处理函数
 */
export interface MonacoEditorCommandHandler {
  execute(editor: monaco.editor.ICodeEditor, ...args: any[]): any;
  isEnabled?(editor: monaco.editor.ICodeEditor, ...args: any[]): boolean;
}

@Injectable()
export class MonacoCommandService implements ICommandService {
  private delegate: ICommandService;
  /**
   * 事件触发器，在执行命令的时候会触发
   * @type {monaco.Emitter<ICommandEvent>}
   * @memberof MonacoCommandService
   */
  _onWillExecuteCommand: monaco.Emitter<ICommandEvent> = new Emitter<ICommandEvent>();

  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  /**
   * 设置委托对象
   * @param delegate 真正要执行 monaco 内部 command 的 commandSerice
   */
  setDelegate(delegate: ICommandService) {
    this.delegate = delegate;
  }

  get onWillExecuteCommand(): monaco.IEvent<ICommandEvent> {
    return this._onWillExecuteCommand.event;
  }

  /**
   * 执行命令
   * 先去全局 commands 里找，若没有尝试执行 delegate 的 command
   * @param commandId
   * @param args
   */
  // @ts-ignore
  executeCommand(commandId: string, ...args: any[]) {
    this.logger.debug('command: ' + commandId);
    const handler = this.commandRegistry.getActiveHandler(commandId, ...args);
    if (handler) {
      try {
        this._onWillExecuteCommand.fire({ commandId });
        return Promise.resolve(handler.execute(...args));
      } catch (err) {
        return Promise.reject(err);
      }
    }
    if (this.delegate) {
      return this.delegate.executeCommand(MonacoCommandAlias[commandId] ? MonacoCommandAlias[commandId] : commandId, ...args);
    }
    return Promise.reject(new Error(`command '${commandId}' not found`));
  }
}

@Injectable()
export class MonacoCommandRegistry {

  protected static MONACO_COMMAND_PREFIX = 'monaco.';

  @Autowired(CommandRegistry)
  protected commands: CommandRegistry;

  @Autowired(WorkbenchEditorService)
  protected workbenchEditorService: WorkbenchEditorService;

  /**
   * 给命令加入 monaco 前缀，防止全局被污染
   * @param command 命令 id
   * @returns 前缀 + command id
   */
  protected prefix(command: string): string {
    return MonacoCommandRegistry.MONACO_COMMAND_PREFIX + command;
  }

  /**
   * 校验 command id 是否是 monaco id
   * @param command 要校验的 id
   * @returns 若找到则为转换过 monaco id，否则为 undefined
   */
  validate(command: string): string | undefined {
    const monacoCommandId = this.prefix(command);
    const monacoCommand = this.commands.getCommands().find((command) => command.id === monacoCommandId);
    return monacoCommand ? monacoCommandId : undefined;
  }

  /**
   * 注册 monaco 命令
   * 命令 id 会统一加入 manaco 前缀
   * monaco handler 会注入当前 editor 参数
   * @param command 注册的命令
   * @param handler 命令处理函数
   */
  registerCommand(command: Command, handler: MonacoEditorCommandHandler): void {
    this.commands.registerCommand({
      ...command,
      id: this.prefix(command.id),
    }, this.newHandler(handler));
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
      editor.focus();
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
    const editor = this.getActiveCodeEditor();
    return !!editor && (!monacoHandler.isEnabled || monacoHandler.isEnabled(editor, ...args));
  }

  /**
   * 获取当前活动的编辑器
   */
  protected getActiveCodeEditor(): monaco.editor.ICodeEditor | undefined {
    if (this.workbenchEditorService.currentEditor) {
      return (this.workbenchEditorService.currentEditor as IMonacoImplEditor).monacoEditor;
    }
  }
}

@Injectable()
export class MonacoActionRegistry {
  protected KEYBOARD_ACTIONS: {
    [action: string]: MonacoCommand,
  } = {
    'undo': {
      ...EDITOR_COMMANDS.UNDO,
      type: MonacoCommandType.ACTION,
    },
    'redo': {
      ...EDITOR_COMMANDS.REDO,
      type: MonacoCommandType.ACTION,
    },
  };
  /**
   * 要排除注册的 Action
   *
   * @protected
   * @memberof MonacoActionModule
   */
  protected static readonly EXCLUDE_ACTIONS = [
    'editor.action.quickCommand',
  ];

  /**
   * 需要添加的 Monaco 为包含的 action
   */
  protected static readonly ACTIONS: MonacoCommand[] = [
    { id: SELECT_ALL_COMMAND, label: localize('selection.all'), type: MonacoCommandType.COMMAND },
  ];

  @Autowired()
  monacoCommandRegistry: MonacoCommandRegistry;

  registerMonacoActions() {
    // 注册 monaco 的action
    for (const action of this.getActions()) {
      // 将 Action 转为可执行的 CommandHandler
      const handler = this.newMonacoActionHandler(action);
      this.monacoCommandRegistry.registerCommand(action, handler);
    }

    // 注册键盘相关的 action
    Object.keys(this.KEYBOARD_ACTIONS).forEach((action) => {
       // 将 Action 转为可执行的 CommandHandler
       const handler = this.newKeyboardHandler(action);
       this.monacoCommandRegistry.registerHandler(this.KEYBOARD_ACTIONS[action].id, handler);
    });
  }

  /**
   * 获取所有 monaco 内部的 Action
   * 依赖 monaco 的加载，禁止在 initialize 阶段获取 Action
   */
  getActions(): MonacoCommand[] {
    // 从 vs/editor/browser/editorExtensions 中获取
    const allActions: MonacoCommand[] = [...MonacoActionRegistry.ACTIONS, ...monaco.editorExtensions.EditorExtensionsRegistry.getEditorActions().map((action) => ({...action, type: MonacoCommandType.ACTION}))];
    return allActions
      .filter((action) => MonacoActionRegistry.EXCLUDE_ACTIONS.indexOf(action.id) === -1)
      .map(({ id, label, type, alias }) => ({ id, label, type, alias }));
  }

  /**
   * 处理 monaco action
   * 若有 delegate 字段则调用内部的 _commandService 执行
   * 否则调用 getAction 去执行
   * @param action monaco action
   */
  newMonacoActionHandler(action: MonacoCommand): MonacoEditorCommandHandler {
    return action.type === MonacoCommandType.COMMAND ? this.newCommandHandler(action.id) : this.newActionHandler(action.id);
  }

  /**
   * 调用 monaco 内部 _commandService 执行命令
   * 实际执行的就是 MonacoCommandService
   * @param commandId 命令名称
   */
  protected newCommandHandler(commandId: string): MonacoEditorCommandHandler {
    return {
      execute: (editor, ...args) => editor._commandService.executeCommand(commandId, ...args),
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
        return !!action && action.isSupported();
      },
    };
  }

  /**
   * 执行 action
   * @param id 要执行的 action
   * @param editor 执行 action 的 editor，默认为当前 editor
   */
  protected runAction(id: string, editor: monaco.editor.ICodeEditor): Promise<void> {
    if (editor) {
      const action = editor.getAction(id);
      if (action && action.isSupported()) {
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
