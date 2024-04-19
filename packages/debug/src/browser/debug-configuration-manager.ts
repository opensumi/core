import { visit } from 'jsonc-parser';

import { Autowired, Injectable } from '@opensumi/di';
import {
  CancellationToken,
  CommandService,
  CommonLanguageId,
  Deferred,
  Emitter,
  Event,
  IContextKey,
  IContextKeyService,
  ILogServiceClient,
  ILoggerManagerClient,
  IStorage,
  PreferenceConfigurations,
  PreferenceService,
  STORAGE_NAMESPACE,
  StorageProvider,
  SupportLogNamespace,
  ThrottledDelayer,
  URI,
  WaitUntilEvent,
  localize,
} from '@opensumi/ide-core-browser';
import { IOpenResourceResult, WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorCollectionService, IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/index';
import { FileSystemError, IFileServiceClient } from '@opensumi/ide-file-service';
import { EOL } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/ide-monaco';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { QuickPickService } from '@opensumi/ide-quick-open';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { WorkspaceVariableContribution } from '@opensumi/ide-workspace/lib/browser/workspace-variable-contribution';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';

import {
  DebugConfiguration,
  DebugConfigurationProviderTriggerKind,
  DebugServer,
  DebugSessionOptions,
  IDebugServer,
  IDebuggerContribution,
  launchSchemaUri,
} from '../common';

import { CONTEXT_DEBUGGERS_AVAILABLE, LAUNCH_VIEW_SCHEME } from './../common/constants';
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

export interface DebugConfigurationType {
  type: string;
  label?: string;
  popupHint?: string;
}

export interface InternalDebugConfigurationProvider {
  type: string;
  label?: string;
  popupHint?: string;
  provideDebugConfigurations(folderUri: string | undefined, token?: CancellationToken): Promise<DebugConfiguration[]>;
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

  @Autowired(IEditorDocumentModelService)
  protected readonly documentService: IEditorDocumentModelService;

  @Autowired(EditorCollectionService)
  protected readonly editorCollectionService: EditorCollectionService;

  @Autowired(ILoggerManagerClient)
  private readonly loggerManagerClient: ILoggerManagerClient;

  protected logger: ILogServiceClient;

  // DebugConfigManager 直接维护的一批内部 DebugConfigurationProvider，用于模块级的快速自定义 Dynamic DebugConfiguration
  protected readonly internalDebugConfigurationProviders = new Map<string, InternalDebugConfigurationProvider>();

  // DebugConfigManager 维护 DebugConfigurationOverride，用于模块级的修改 Debugger 的 Label 和提示
  protected readonly internalDebugConfigurationOverride = new Map<string, DebugConfigurationType>();

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
    this.logger = this.loggerManagerClient.getLogger(SupportLogNamespace.Browser);
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
    const recentDynamicOptions = this.getRecentDynamicConfigurations();

    recentDynamicOptions.forEach((config, index) => {
      debugSessionOptions.push({
        configuration: config,
        workspaceFolderUri: this.model?.workspaceFolderUri,
        index,
      });
    });

    for (const model of this.models.values()) {
      for (let index = 0, len = model.configurations.length; index < len; index++) {
        debugSessionOptions.push({
          configuration: model.configurations[index],
          workspaceFolderUri: model.workspaceFolderUri,
          index, // 这里的 index 要遵循 model.configurations 的顺序，后面的 find 函数需要用 index 去匹配
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
    const recentDynamicOptions = this.getRecentDynamicConfigurations();
    const matchedRecentDynamicOptions = recentDynamicOptions.find((config) => config.name === name);
    if (matchedRecentDynamicOptions) {
      return {
        configuration: matchedRecentDynamicOptions,
        workspaceFolderUri: this.model?.workspaceFolderUri,
        index: recentDynamicOptions.indexOf(matchedRecentDynamicOptions),
      };
    }

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

  async openLaunchEditor(): Promise<void> {
    if (!this.model) {
      return;
    }

    const uri = this.model.uri;
    if (!uri) {
      return;
    }

    await this.workbenchEditorService.open(uri.withScheme(LAUNCH_VIEW_SCHEME), {
      disableNavigate: true,
    });
  }

  private visitConfigurationsEditor(model: ITextModel): monaco.Position | undefined {
    let position: monaco.Position | undefined;
    let depthInArray = 0;
    let lastProperty = '';
    visit(model.getValue(), {
      onObjectProperty: (property) => {
        lastProperty = property;
      },
      onArrayBegin: (offset) => {
        if (lastProperty === 'configurations' && depthInArray === 0) {
          position = model.getPositionAt(offset + 1);
        }
        depthInArray++;
      },
      onArrayEnd: () => {
        depthInArray--;
      },
    });

    return position;
  }

  async insertConfiguration(uri: URI, configuration: DebugConfiguration): Promise<void> {
    let ref = this.documentService.getModelReference(uri);
    if (!ref) {
      ref = await this.documentService.createModelReference(uri);
    }

    const model = ref.instance.getMonacoModel();
    const eol = model.getEOL();
    const position: monaco.Position | undefined = this.visitConfigurationsEditor(model);
    if (!position) {
      return;
    }

    const { indentSize, insertSpaces } = model.getOptions();
    // 获取 configurations 字符串前面的空格个数
    const spacesMatch = model.getLineContent(position.lineNumber).match(/^\s*/);
    const leadingSpaces = spacesMatch ? spacesMatch[0].length : 0;
    const indent = insertSpaces ? ' '.repeat(indentSize + leadingSpaces) : '\t';

    const decompose = JSON.stringify(configuration, null, indentSize).split(EOL.LF);
    const length = decompose.length;
    const indentContent = decompose.reduce(
      (pre, cur, index) => pre + indent + cur + (index === length - 1 ? '' : EOL.LF),
      '',
    );

    model.pushEditOperations(
      null,
      [EditOperation.insert(position, eol), EditOperation.insert(position, indentContent + ',')],
      () => null,
    );
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

    const position: monaco.Position | undefined = this.visitConfigurationsEditor(editor.getModel()!);
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

  /**
   * 初始化 launch 文件
   */
  public async createInitialConfig(uri: URI, configurations: DebugConfiguration[] = []): Promise<void> {
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
  }

  public async showDynamicConfigurationsTypesQuickPick() {
    const debugTypes = await this.getDynamicConfigurationsSupportTypes();
    const debugType = await this.quickPick.show(
      debugTypes.map((debugType) => ({ label: debugType.label || debugType.type, value: debugType.type })),
      {
        placeholder: localize('debug.configuration.selectAutomaticDebugTypes'),
      },
    );
    return debugType;
  }

  public async getDynamicConfigurationsSupportTypes(): Promise<DebugConfigurationType[]> {
    const debugTypes = new Set<string>();

    const typesFromInternal = Array.from(this.internalDebugConfigurationProviders.keys());
    typesFromInternal.forEach((type) => debugTypes.add(type));
    const typesFromExt = await this.debug.getDynamicConfigurationsSupportTypes();
    typesFromExt.forEach((type) => debugTypes.add(type));

    return Array.from(debugTypes).map((type) => ({
      type,
      label: this.getDebuggerLabel(type),
      popupHint: this.getDebuggerExtraPopupHint(type),
    }));
  }

  public async showDynamicConfigurationsQuickPick(type: string): Promise<DebugConfiguration | undefined> {
    const configurations = await this.provideDynamicDebugConfigurations(type, this.model?.workspaceFolderUri);
    let result: DebugConfiguration | undefined;
    if (configurations.length > 0 && configurations[0]['autoPick']) {
      // 无需拉起 QuickPick，直接选中第一个（某些情况下，ProvideConfiguration 后不希望用户多余的操作）
      result = configurations[0];
      delete result['autoPick'];
    } else {
      result = await this.quickPick.show(
        configurations.map((config) => ({ label: config.name, value: config })),
        {
          placeholder: localize('debug.configuration.selectAutomaticDebugConfiguration'),
        },
      );
    }

    if (result) {
      await this.addRecentDynamicConfiguration(result);
      this.onDidChangeEmitter.fire(undefined);
    }
    return result;
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
    await this.createInitialConfig(uri, configurations);
    return uri;
  }

  protected async provideDebugConfigurations(
    debugType: string,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration[]> {
    await this.fireWillProvideDebugConfiguration();
    return this.debug.provideDebugConfigurations(debugType, workspaceFolderUri);
  }

  public async provideDynamicDebugConfigurations(
    debugType: string,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration[]> {
    await this.fireWillProvideDebugConfiguration();
    const configurationList: DebugConfiguration[] = [];
    const internalProvider = this.internalDebugConfigurationProviders.get(debugType);
    // 额外从 internalProvider 中获取配置
    if (internalProvider) {
      const internalList = internalProvider && (await internalProvider.provideDebugConfigurations(workspaceFolderUri));
      internalList && configurationList.push(...internalList);
    }
    const extList = await this.debug.provideDebugConfigurations(
      debugType,
      workspaceFolderUri,
      DebugConfigurationProviderTriggerKind.Dynamic,
    );
    configurationList.push(...extList);
    return configurationList;
  }

  /**
   * 通过模块的方式注册 DynamicDebugConfigurationProvider
   * 此途径不经过插件，可以基于模块能力做更加便捷的集成
   */
  registerInternalDebugConfigurationProvider(type: string, provider: InternalDebugConfigurationProvider): void {
    this.internalDebugConfigurationProviders.set(type, provider);
    this.onDidChangeEmitter.fire(undefined);
  }

  /**
   * 可以通过注册 DebugConfigurationType 空实现的方式来 OverRide 现有 ConfigurationProvider 的一些 Label 或者 Hint
   * @param type debugger Type
   * @param debugConfigurationOverride 覆写的 Debugger Label 和提示
   */
  registerInternalDebugConfigurationOverride(type: string, debugConfigurationOverride: DebugConfigurationType) {
    this.internalDebugConfigurationOverride.set(type, debugConfigurationOverride);
    this.onDidChangeEmitter.fire(undefined);
  }

  // 获取临时存储的 Dynamic DebugConfigurations，方便用户快速选择之前用过的动态配置
  getRecentDynamicConfigurations(): DebugConfiguration[] {
    return this.debugConfigurationStorage.get('recentDynamicConfigurations', []);
  }

  async setRecentDynamicConfigurations(configurations: DebugConfiguration[]) {
    return await this.debugConfigurationStorage.set('recentDynamicConfigurations', configurations || []);
  }

  async addRecentDynamicConfiguration(configuration: DebugConfiguration) {
    const configurations = this.getRecentDynamicConfigurations();
    // 检查有没有重复的配置，如果有则删除
    const index = configurations.findIndex((config) => config.name === configuration.name);
    if (index !== -1) {
      configurations.splice(index, 1);
    }
    configurations.unshift(configuration);
    // 如果数组长度大于 3，那么删除后面的所有元素，避免记忆的智能 Debug 配置过多
    if (configurations.length > 3) {
      configurations.splice(3);
    }
    await this.setRecentDynamicConfigurations(configurations);
  }

  protected async fireWillProvideDebugConfiguration(): Promise<void> {
    try {
      // 这个命令背后会触发 ActivateEvent，然后插件 Activate 的时候可能会抛出异常导致逻辑错误
      await WaitUntilEvent.fire(this.onWillProvideDebugConfigurationEmitter, {}, 2000);
    } catch (e) {
      this.logger.error('fireWillProvideDebugConfiguration failed', e);
    }
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
    await this.debugConfigurationStorage.set('configurations', data);
  }

  /**
   * 判断当前文档是否支持断点
   * @param model
   */
  canSetBreakpointsIn(model: ITextModel) {
    if (!model) {
      return false;
    }
    const modeId = model.getLanguageId();
    if (!modeId || modeId === CommonLanguageId.JSONC || modeId === CommonLanguageId.Log) {
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

  getDebuggerLabel(type: string): string | undefined {
    const internalDebugConfigurationOverride = this.internalDebugConfigurationOverride.get(type);
    if (internalDebugConfigurationOverride) {
      return internalDebugConfigurationOverride.label || type;
    }
    // 如果有 internalProvider 则优先使用 internalProvider 的 label
    const internalProvider = this.internalDebugConfigurationProviders.get(type);
    if (internalProvider) {
      return internalProvider.label || type;
    }
    const dbgr = this.getDebugger(type);
    if (dbgr) {
      return dbgr.label || type;
    }

    return undefined;
  }

  // 获取 DebugConfiguration 选择面板里额外的 Hover 提示，这里可以通过模块注入（便于用户更好理解一些 Automatic DebugConfiguration 的能力）
  getDebuggerExtraPopupHint(type: string): string | undefined {
    const internalDebugConfigurationOverride = this.internalDebugConfigurationOverride.get(type);
    if (internalDebugConfigurationOverride) {
      return internalDebugConfigurationOverride.popupHint || undefined;
    }
    // 如果有 internalProvider 则优先使用 internalProvider 的 label
    const internalProvider = this.internalDebugConfigurationProviders.get(type);
    if (internalProvider) {
      return internalProvider.popupHint || undefined;
    }
  }
}
