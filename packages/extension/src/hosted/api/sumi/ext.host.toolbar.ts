import { IRPCProtocol } from '@opensumi/ide-connection';
import { IToolbarPopoverStyle } from '@opensumi/ide-core-browser/lib/toolbar';
import { Emitter, Disposable, IExtensionLogger } from '@opensumi/ide-core-common';

import {
  IToolbarButtonContribution,
  IToolbarDropdownButtonContribution,
  IToolbarSelectContribution,
} from '../../../browser/sumi/types';
import { MainThreadSumiAPIIdentifier } from '../../../common/sumi';
import {
  IToolbarButtonActionHandle,
  IToolbarSelectActionHandle,
  IMainThreadToolbar,
  IExtHostToolbar,
  IToolbarDropdownButtonActionHandle,
  DROPDOWN_BUTTON_ON_SELECT_ID,
  BUTTON_SET_STATE_ID,
  SHOW_POPOVER_ID,
  HIDE_POPOVER_ID,
  BUTTON_SET_CONTEXT_ID,
  BUTTON_CLICK_ID,
  BUTTON_STATE_CHANGE_ID,
  BUTTON_CONNECT_HANDLE_ID,
  SELECT_SET_STATE_ID,
  SELECT_SET_OPTIONS,
  SELECT_SET_SELECT_ID,
  SELECT_CONNECT_HANDLE_ID,
  SELECT_ON_SELECT_ID,
  SELECT_STATE_CHANGE_ID,
  TOOLBAR_ACTION_TYPE,
} from '../../../common/sumi/toolbar';
import { IExtHostCommands, IExtensionDescription } from '../../../common/vscode';

import { ExtHostCommon } from './ext.host.common';

export function createToolbarAPIFactory(extension: IExtensionDescription, service: ExtHostToolbarActionService) {
  return {
    registerToolbarAction: async <T>(
      contribution: IToolbarButtonContribution | IToolbarSelectContribution<T> | IToolbarDropdownButtonContribution<T>,
    ): Promise<IToolbarButtonActionHandle | IToolbarSelectActionHandle<T> | IToolbarDropdownButtonActionHandle<T>> =>
      service.registerToolbarAction<T>(extension.id, extension.path, contribution),
    getToolbarActionButtonHandle: async (id) => service.getToolbarButtonActionHandle(id, extension.id),
    getToolbarActionSelectHandle: async (id) => service.getToolbarSelectActionHandle(id, extension.id),
    getToolbarActionDropdownButtonHandle: async (id) => service.getToolbarDropdownButtonActionHandle(id, extension.id),
  };
}

export class ExtHostToolbarActionService implements IExtHostToolbar {
  private btnHandles = new Map<string, Promise<ToolbarBtnActionHandleController>>();

  private selectHandles = new Map<string, Promise<ToolbarSelectActionHandleController<any>>>();

  private dropdownButtonHandles = new Map<string, Promise<ToolbarDropdownButtonActionHandleController<any>>>();

  private readonly proxy: IMainThreadToolbar;

  constructor(
    private extHostCommands: IExtHostCommands,
    private extHostCommon: ExtHostCommon,
    private rpcProtocol: IRPCProtocol,
    public logger: IExtensionLogger,
  ) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadSumiAPIIdentifier.MainThreadToolbar);
  }

  async registerToolbarAction<T>(
    extensionId: string,
    extensionPath: string,
    contribution: IToolbarButtonContribution | IToolbarSelectContribution | IToolbarDropdownButtonContribution,
  ): Promise<IToolbarButtonActionHandle | IToolbarSelectActionHandle<T> | IToolbarDropdownButtonActionHandle<T>> {
    switch (contribution.type) {
      case TOOLBAR_ACTION_TYPE.BUTTON:
        await this.proxy.$registerToolbarButtonAction(extensionId, extensionPath, contribution);
        return this.getToolbarButtonActionHandle(contribution.id, extensionId);
      case TOOLBAR_ACTION_TYPE.DROPDOWN_BUTTON:
        await this.proxy.$registerDropdownButtonAction(extensionId, extensionPath, contribution);
        return this.getToolbarDropdownButtonActionHandle(contribution.id, extensionId);
      case TOOLBAR_ACTION_TYPE.SELECT:
        await this.proxy.$registerToolbarSelectAction(extensionId, extensionPath, contribution);
        return this.getToolbarSelectActionHandle(contribution.id, extensionId);
      default:
        await this.proxy.$registerToolbarSelectAction(
          extensionId,
          extensionPath,
          contribution as IToolbarSelectContribution<T>,
        );
        return this.getToolbarSelectActionHandle(contribution.id, extensionId);
    }
  }

  getToolbarButtonActionHandle(id: string, extensionId: string): Promise<IToolbarButtonActionHandle> {
    const compositeKey = extensionId + '.' + id;
    if (!this.btnHandles.has(compositeKey)) {
      const promise = new Promise<ToolbarBtnActionHandleController>((resolve, reject) => {
        const h = new ToolbarBtnActionHandleController(
          compositeKey,
          this.extHostCommands,
          this.extHostCommon,
          this.logger,
        );
        h.init()
          .then(() => {
            resolve(h);
          })
          .catch((e) => {
            reject(e);
          });
      });
      this.btnHandles.set(compositeKey, promise);
    }
    return this.btnHandles.get(compositeKey)!.then((h) => h.handle);
  }

  getToolbarSelectActionHandle<T = any>(id: string, extensionId: string): Promise<IToolbarSelectActionHandle<T>> {
    const compositeKey = extensionId + '.' + id;
    if (!this.selectHandles.has(compositeKey)) {
      const promise = new Promise<ToolbarSelectActionHandleController<T>>((resolve, reject) => {
        const h = new ToolbarSelectActionHandleController<T>(compositeKey, this.extHostCommands, this.extHostCommon);
        h.init()
          .then(() => {
            resolve(h);
          })
          .catch((e) => {
            reject(e);
          });
      });
      this.selectHandles.set(compositeKey, promise);
    }
    return this.selectHandles.get(compositeKey)!.then((h) => h.handle);
  }

  getToolbarDropdownButtonActionHandle<T = any>(
    id: string,
    extensionId: string,
  ): Promise<IToolbarDropdownButtonActionHandle<T>> {
    const compositeKey = extensionId + '.' + id;
    if (!this.dropdownButtonHandles.has(compositeKey)) {
      const promise = new Promise<ToolbarDropdownButtonActionHandleController<T>>((resolve, reject) => {
        const h = new ToolbarDropdownButtonActionHandleController<T>(
          compositeKey,
          this.extHostCommands,
          this.extHostCommon,
        );
        h.init()
          .then(() => {
            resolve(h);
          })
          .catch((e) => {
            reject(e);
          });
      });
      this.dropdownButtonHandles.set(compositeKey, promise);
    }
    return this.dropdownButtonHandles.get(compositeKey)!.then((h) => h.handle);
  }
}

export class ToolbarBtnActionHandleController extends Disposable {
  private _handle: IToolbarButtonActionHandle;

  private _onClick = new Emitter<void>();

  private _onStateChange = new Emitter<{ from: string; to: string }>();

  constructor(
    public readonly id: string,
    private extHostCommands: IExtHostCommands,
    private kaitianCommon: ExtHostCommon,
    private logger: IExtensionLogger,
  ) {
    super();
  }

  get handle(): IToolbarButtonActionHandle {
    if (!this._handle) {
      this._handle = {
        onClick: this._onClick.event,
        onStateChanged: this._onStateChange.event,
        setState: (state, title?: string) =>
          this.extHostCommands.executeCommand<void>(BUTTON_SET_STATE_ID, this.id, state, title),
        showPopover: async (style?: IToolbarPopoverStyle) =>
          this.extHostCommands.executeCommand<void>(SHOW_POPOVER_ID, this.id, style),
        hidePopover: async () => this.extHostCommands.executeCommand<void>(HIDE_POPOVER_ID, this.id),
        /**
         * 由插件 API 负责更新的 context 对象
         * 在自定义 popover 场景下，该 context 对象会被序列化后从 popover 组件 props 传入
         * @param context {T}
         */
        setContext: <T>(context: T) =>
          this.extHostCommands.executeCommand<void>(BUTTON_SET_CONTEXT_ID, this.id, context),
      };
    }
    return this._handle;
  }

  async init() {
    this.addDispose(
      this.kaitianCommon.onEvent(BUTTON_CLICK_ID, (id) => {
        if (id === this.id) {
          this._onClick.fire();
        }
      }),
    );
    this.addDispose(
      this.kaitianCommon.onEvent(BUTTON_STATE_CHANGE_ID, (id, from, to) => {
        if (id === this.id) {
          this._onStateChange.fire({ from, to });
        }
      }),
    );
    this.logger.log('init button handle', this.id);
    return this.extHostCommands.executeCommand(BUTTON_CONNECT_HANDLE_ID, this.id);
  }
}

export class ToolbarSelectActionHandleController<T> extends Disposable {
  private _handle: IToolbarSelectActionHandle<T>;

  private _onSelect = new Emitter<T>();

  private _onStateChange = new Emitter<{ from: string; to: string }>();

  private _value: T;

  constructor(
    public readonly id: string,
    private extHostCommands: IExtHostCommands,
    private kaitianCommon: ExtHostCommon,
  ) {
    super();
  }

  get handle(): IToolbarSelectActionHandle<T> {
    if (!this._handle) {
      this._handle = {
        onSelect: this._onSelect.event,
        onStateChanged: this._onStateChange.event,
        setState: (state, title?: string) =>
          this.extHostCommands.executeCommand<void>(SELECT_SET_STATE_ID, this.id, state, title),
        setOptions: (options: any, iconBasePath?: string) =>
          this.extHostCommands.executeCommand<void>(SELECT_SET_OPTIONS, this.id, iconBasePath, options),
        setSelect: (value: T) => this.extHostCommands.executeCommand<void>(SELECT_SET_SELECT_ID, this.id, value),
        getValue: () => this._value,
      };
    }
    return this._handle;
  }

  async init() {
    this.addDispose(
      this.kaitianCommon.onEvent(SELECT_ON_SELECT_ID, (id, value) => {
        if (id === this.id) {
          this._onSelect.fire(value);
        }
      }),
    );
    this.addDispose(
      this.kaitianCommon.onEvent(SELECT_STATE_CHANGE_ID, (id, from, to) => {
        if (id === this.id) {
          this._onStateChange.fire({ from, to });
        }
      }),
    );
    this._value = (await this.extHostCommands.executeCommand(SELECT_CONNECT_HANDLE_ID, this.id)) as T;
  }
}

export class ToolbarDropdownButtonActionHandleController<T> extends Disposable {
  private _handle: IToolbarDropdownButtonActionHandle<T>;

  private _onSelect = new Emitter<T>();

  constructor(
    public readonly id: string,
    private _extHostCommands: IExtHostCommands,
    private extHostCommon: ExtHostCommon,
  ) {
    super();
  }

  get handle(): IToolbarDropdownButtonActionHandle<T> {
    if (!this._handle) {
      this._handle = {
        onSelect: this._onSelect.event,
      };
    }
    return this._handle;
  }

  async init() {
    this.addDispose(
      this.extHostCommon.onEvent(DROPDOWN_BUTTON_ON_SELECT_ID, (id, value) => {
        if (id === this.id) {
          this._onSelect.fire(value);
        }
      }),
    );
  }
}
