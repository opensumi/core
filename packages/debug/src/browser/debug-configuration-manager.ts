import { visit } from 'jsonc-parser';

import { Injectable, Autowired } from '@opensumi/di';
import {
  PreferenceConfigurations,
  IContextKey,
  Emitter,
  Event,
  PreferenceService,
  URI,
  WaitUntilEvent,
  IContextKeyService,
  CommandService,
  localize,
  StorageProvider,
  STORAGE_NAMESPACE,
  IStorage,
  ThrottledDelayer,
  Deferred,
} from '@opensumi/ide-core-browser';
import { WorkbenchEditorService, IOpenResourceResult } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { FileSystemError } from '@opensumi/ide-file-service';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { QuickPickService } from '@opensumi/ide-quick-open';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceVariableContribution } from '@opensumi/ide-workspace/lib/browser/workspace-variable-contribution';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';


import { DebugServer, IDebugServer, IDebuggerContribution, launchSchemaUri } from '../common';
import { DebugSessionOptions } from '../common';
import { DebugConfiguration } from '../common';

import { CONTEXT_DEBUGGERS_AVAILABLE } from './../common/constants';
import { DebugConfigurationModel } from './debug-configuration-model';
import { DebugPreferences } from './debug-preferences';


export type WillProvideDebugConfiguration = WaitUntilEvent;
export type WillInitialConfiguration = WaitUntilEvent;

export interface IDebugConfigurationData {
  current?: {
    name: string;
    workspaceFolderUri?: string;
    index: number;
  };
}

@Injectable()
export class DebugConfigurationManager {
  static DEFAULT_UPDATE_MODEL_TIMEOUT = 500;

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(WorkbenchEditorService)
  protected readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(IDebugServer)
  protected readonly debug: DebugServer;

  @Autowired(QuickPickService)
  protected readonly quickPick: QuickPickService;

  @Autowired(IContextKeyService)
  protected readonly contextKeyService: IContextKeyService;

  @Autowired(IFileServiceClient)
  protected readonly filesystem: IFileServiceClient;

  @Autowired(PreferenceService)
  protected readonly preferences: PreferenceService;

  @Autowired(PreferenceConfigurations)
  protected readonly preferenceConfigurations: PreferenceConfigurations;

  @Autowired(WorkspaceVariableContribution)
  protected readonly workspaceVariables: WorkspaceVariableContribution;

  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(DebugPreferences)
  protected readonly debugPreferences: DebugPreferences;

  private contextDebuggersAvailable: IContextKey<boolean>;

  // 用于存储支持断点的语言
  private breakpointModeIdsSet = new Set<string>();
  // 用于存储debugger信息
  private debuggers: IDebuggerContribution[] = [];

  protected readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;

  protected readonly onWillProvideDebugConfigurationEmitter = new Emitter<WillProvideDebugConfiguration>();
  readonly onWillProvideDebugConfiguration: Event<WillProvideDebugConfiguration> =
    this.onWillProvideDebugConfigurationEmitter.event;

  private _whenReadyDeferred: Deferred<void> = new Deferred();
  protected updateModelDelayer: ThrottledDelayer<void> = new ThrottledDelayer(
    DebugConfigurationManager.DEFAULT_UPDATE_MODEL_TIMEOUT,
  );

  private debugConfigurationStorage: IStorage;
  constructor() {
    this.init();
    this.contextDebuggersAvailable = CONTEXT_DEBUGGERS_AVAILABLE.bind(this.contextKeyService);
  }

  protected async init(): Promise<void> {
    this.preferences.onPreferenceChanged((e) => {
      if (e.preferenceName === 'launch') {
        this.updateModels();
      }
    });
    this.debugConfigurationStorage = await this.storageProvider(STORAGE_NAMESPACE.DEBUG);
    this.updateModels();
  }

  protected readonly models = new Map<string, DebugConfigurationModel>();

  protected updateModels = () =>
    this.updateModelDelayer.trigger(async () => {
      const roots = await this.workspaceService.roots;
      const toDelete = new Set(this.models.keys());
      for (const rootStat of roots) {
        const key = rootStat.uri;
        toDelete.delete(key);
        if (!this.models.has(key)) {
          const model = new DebugConfigurationModel(key, this.preferences);
          model.onDidChange(() => this.updateCurrent());
          model.onDispose(() => this.models.delete(key));
          this.models.set(key, model);
        }
      }
      for (const uri of toDelete) {
        const model = this.models.get(uri);
        if (model) {
          model.dispose();
        }
      }
      this.updateCurrent();
      let configEmpty = true;
      this.models.forEach((model) => {
        if (model.configurations.length) {
          configEmpty = false;
        }
      });
      this.contextDebuggersAvailable.set(!configEmpty);
      if (this._whenReadyDeferred) {
        this._whenReadyDeferred.resolve();
      }
    });

  get whenReady() {
    return this._whenReadyDeferred.promise;
  }

  get all(): DebugSessionOptions[] {
    return this.getAll();
  }

  protected getAll(): DebugSessionOptions[] {
    const debugSessionOptions: DebugSessionOptions[] = [];
    for (const model of this.models.values()) {
      for (let index = 0, len = model.configurations.length; index < len; index++) {
        debugSessionOptions.push({
          configuration: model.configurations[index],
          workspaceFolderUri: model.workspaceFolderUri,
          index,
        });
      }
    }
    return debugSessionOptions;
  }

  get supported(): Promise<DebugSessionOptions[]> {
    return this.getSupported();
  }

  protected async getSupported(): Promise<DebugSessionOptions[]> {
    await this.whenReady;
    const debugTypes = await this.debug.debugTypes();
    return this.doGetSupported(new Set(debugTypes));
  }

  protected doGetSupported(debugTypes: Set<string>): DebugSessionOptions[] {
    const supported: DebugSessionOptions[] = [];
    for (const options of this.getAll()) {
      if (debugTypes.has(options.configuration.type)) {
        supported.push(options);
      }
    }
    return supported;
  }

  protected _currentOptions: DebugSessionOptions | undefined;
  get current(): DebugSessionOptions | undefined {
    return this._currentOptions;
  }
  set current(option: DebugSessionOptions | undefined) {
    this.updateCurrent(option);
  }

  protected updateCurrent(options: DebugSessionOptions | undefined = this._currentOptions): void {
    this._currentOptions = options && this.find(options.configuration.name, options.workspaceFolderUri, options.index);
    if (!this._currentOptions) {
      const { model } = this;
      if (model) {
        const configuration = model.configurations[0];
        if (configuration) {
          this._currentOptions = {
            configuration,
            workspaceFolderUri: model.workspaceFolderUri,
            index: options?.index || 0,
          };
        }
      }
    }
    this.onDidChangeEmitter.fire(undefined);
  }

  find(name: string, workspaceFolderUri: string | undefined, index?: number): DebugSessionOptions | undefined {
    for (const model of this.models.values()) {
      if (model.workspaceFolderUri === workspaceFolderUri) {
        if (typeof index === 'number') {
          const configuration = model.configurations[index];
          if (configuration && configuration.name === name) {
            return {
              configuration,
              workspaceFolderUri,
              index,
            };
          }
        } else {
          // 兼容无index的查找逻辑
          for (let index = 0, len = model.configurations.length; index < len; index++) {
            if (model.configurations[index].name === name) {
              return {
                configuration: model.configurations[index],
                workspaceFolderUri,
                index,
              };
            }
          }
        }
      }
    }
    return undefined;
  }

  async openConfiguration(uri?: string): Promise<void> {
    let model: DebugConfigurationModel | undefined;
    if (uri) {
      model = this.getModelByUri(uri);
    } else {
      model = this.model;
    }
    if (model) {
      await this.doOpen(model);
    }
  }

  async addConfiguration(uri?: string): Promise<void> {
    let model: DebugConfigurationModel | undefined;
    if (uri) {
      model = this.getModelByUri(uri);
    } else {
      model = this.model;
    }
    if (!model) {
      return;
    }
    const resouce = await this.doOpen(model);
    if (!resouce) {
      return;
    }
    const { group } = resouce;
    const editor = group.codeEditor.monacoEditor;
    if (!editor) {
      return;
    }

    let position: monaco.Position | undefined;
    let depthInArray = 0;
    let lastProperty = '';
    visit(editor.getValue(), {
      onObjectProperty: (property) => {
        lastProperty = property;
      },
      onArrayBegin: (offset) => {
        if (lastProperty === 'configurations' && depthInArray === 0) {
          position = editor.getModel()!.getPositionAt(offset + 1);
        }
        depthInArray++;
      },
      onArrayEnd: () => {
        depthInArray--;
      },
    });
    if (!position) {
      return;
    }
    // 判断在"configurations": [后是否有字符，如果有则新建一行
    if (editor.getModel()!.getLineLastNonWhitespaceColumn(position.lineNumber) > position.column) {
      editor.setPosition(position);
      editor.trigger(launchSchemaUri, 'lineBreakInsert', undefined);
    }
    // 判断是否已有空行可用于插入建议，如果有，直接替换对应的光标位置
    if (editor.getModel()!.getLineLastNonWhitespaceColumn(position.lineNumber + 1) === 0) {
      editor.setPosition({ lineNumber: position.lineNumber + 1, column: 1 << 30 });
      editor.trigger(null, 'editor.action.deleteLines', []);
    }
    editor.setPosition(position);
    editor.trigger(null, 'editor.action.insertLineAfter', []);
    editor.trigger(null, 'editor.action.triggerSuggest', []);
  }

  protected get model(): DebugConfigurationModel | undefined {
    const workspaceFolderUri = this.workspaceVariables.getWorkspaceRootUri();
    if (workspaceFolderUri) {
      const key = workspaceFolderUri.toString();
      for (const model of this.models.values()) {
        if (model.workspaceFolderUri === key) {
          return model;
        }
      }
    }
    for (const model of this.models.values()) {
      if (model.uri) {
        return model;
      }
    }
    return this.models.values().next().value;
  }

  protected getModelByUri(uri: string): DebugConfigurationModel | undefined {
    if (uri) {
      const key = uri;
      for (const model of this.models.values()) {
        if (model.workspaceFolderUri === key) {
          return model;
        }
      }
    }
    for (const model of this.models.values()) {
      if (model.uri) {
        return model;
      }
    }
    return this.models.values().next().value;
  }

  protected async doOpen(model: DebugConfigurationModel): Promise<IOpenResourceResult> {
    let uri = model.uri;
    if (!uri) {
      uri = await this.doCreate(model);
    }
    return this.workbenchEditorService.open(uri, {
      disableNavigate: true,
    });
  }

  protected async doCreate(model: DebugConfigurationModel): Promise<URI> {
    // 设置launch初始值
    await this.preferences.set('launch', {});
    // 获取可写入内容的文件
    const { configUri } = this.preferences.resolve('launch');
    let uri: URI;
    if (configUri && configUri.path.base === 'launch.json') {
      uri = configUri;
    } else {
      uri = new URI(model.workspaceFolderUri).resolve(`${this.preferenceConfigurations.getPaths()[0]}/launch.json`);
    }
    const debugType = await this.selectDebugType();
    const configurations = debugType ? await this.provideDebugConfigurations(debugType, model.workspaceFolderUri) : [];
    const content = this.getInitialConfigurationContent(configurations);
    const fileStat = await this.filesystem.getFileStat(uri.toString());

    if (!fileStat) {
      await this.filesystem.createFile(uri.toString(), {
        content,
      });
    } else {
      try {
        await this.filesystem.setContent(fileStat, content);
      } catch (e) {
        if (!FileSystemError.FileExists.is(e)) {
          throw e;
        }
      }
    }

    return uri;
  }

  protected async provideDebugConfigurations(
    debugType: string,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration[]> {
    await this.fireWillProvideDebugConfiguration();
    return this.debug.provideDebugConfigurations(debugType, workspaceFolderUri);
  }

  protected async fireWillProvideDebugConfiguration(): Promise<void> {
    await WaitUntilEvent.fire(this.onWillProvideDebugConfigurationEmitter, {});
  }

  protected getInitialConfigurationContent(initialConfigurations: DebugConfiguration[]): string {
    const comment1 = localize('debug.configuration.comment1');
    const comment2 = localize('debug.configuration.comment2');
    const comment3 = localize('debug.configuration.comment3');
    return `{
  // ${comment1}
  // ${comment2}
  // ${comment3}
  "version": "0.2.0",
  "configurations": ${JSON.stringify(initialConfigurations, undefined, '  ')
    .split('\n')
    .map((line) => '  ' + line)
    .join('\n')
    .trim()}
}
`;
  }

  protected async selectDebugType(): Promise<string | undefined> {
    const editor = this.workbenchEditorService.currentEditor;
    if (!editor) {
      return undefined;
    }
    const document = editor.currentDocumentModel;
    if (!document) {
      return undefined;
    }
    const debuggers = await this.debug.getDebuggersForLanguage(document.languageId);
    return this.quickPick.show(
      debuggers.map(({ label, type }) => ({ label, value: type }), { placeholder: 'Select Environment' }),
    );
  }

  async load(): Promise<void> {
    await this.whenReady;
    const data = this.debugConfigurationStorage.get<IDebugConfigurationData>('configurations');
    if (data && data.current) {
      this.current = this.find(data.current.name, data.current.workspaceFolderUri, data.current.index);
    }
  }

  async save(): Promise<void> {
    const data: IDebugConfigurationData = {};
    const { current } = this;
    if (current) {
      data.current = {
        name: current.configuration.name,
        workspaceFolderUri: current.workspaceFolderUri,
        index: current.index,
      };
    }
    this.debugConfigurationStorage.set('configurations', data);
  }

  /**
   * 判断当前文档是否支持断点
   * @param model
   */
  canSetBreakpointsIn(model: ITextModel) {
    if (!model) {
      return false;
    }
    const modeId = (model as any).getLanguageIdentifier().language;
    if (!modeId || modeId === 'jsonc' || modeId === 'log') {
      // 不允许在JSONC类型文件及log文件中断点
      return false;
    }
    if (this.debugPreferences['preference.debug.allowBreakpointsEverywhere']) {
      return true;
    }
    return this.breakpointModeIdsSet.has(modeId);
  }

  addSupportBreakpoints(languageId: string) {
    this.breakpointModeIdsSet.add(languageId);
  }

  removeSupportBreakpoints(languageId: string) {
    this.breakpointModeIdsSet.delete(languageId);
  }

  registerDebugger(debuggerContribution: IDebuggerContribution) {
    if (debuggerContribution.type !== '*') {
      const existing = this.getDebugger(debuggerContribution.type as string);
      if (existing) {
        // VSCode中会将插件贡献点根据isBuildIn进行覆盖式合并
        return;
      } else {
        this.debuggers.push(debuggerContribution);
      }
    }
  }

  getDebugger(type: string): IDebuggerContribution | undefined {
    return this.debuggers.filter((dbg) => dbg.type === type).pop();
  }

  getDebuggers(): IDebuggerContribution[] {
    return this.debuggers.filter((dbg) => !!dbg);
  }
}
