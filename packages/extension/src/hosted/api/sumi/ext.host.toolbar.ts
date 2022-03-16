import { IRPCProtocol } from '@opensumi/ide-connection';
import { IToolbarPopoverStyle } from '@opensumi/ide-core-browser/lib/toolbar';
import { Emitter, Disposable } from '@opensumi/ide-core-common';

import { IToolbarButtonContribution, IToolbarSelectContribution } from '../../../browser/sumi/types';
import { MainThreadSumiAPIIdentifier } from '../../../common/sumi';
import {
  IToolbarButtonActionHandle,
  IToolbarSelectActionHandle,
  IMainThreadToolbar,
  IExtHostToolbar,
} from '../../../common/sumi/toolbar';
import { IExtHostCommands, IExtensionDescription } from '../../../common/vscode';

import { ExtHostCommon } from './ext.host.common';


export function createToolbarAPIFactory(extension: IExtensionDescription, service: ExtHostToolbarActionService) {
  return {
    registerToolbarAction: async <T>(
      contribution: IToolbarButtonContribution | IToolbarSelectContribution<T>,
    ): Promise<IToolbarButtonActionHandle | IToolbarSelectActionHandle<T>> =>
      service.registerToolbarAction<T>(extension.id, extension.path, contribution),
    getToolbarActionButtonHandle: async (id) => service.getToolbarButtonActionHandle(id, extension.id),
    getToolbarActionSelectHandle: async (id) => service.getToolbarSelectActionHandle(id, extension.id),
  };
}

export class ExtHostToolbarActionService implements IExtHostToolbar {
  private btnHandles = new Map<string, Promise<ToolbarBtnActionHandleController>>();

  private selectHandles = new Map<string, Promise<ToolbarSelectActionHandleController<any>>>();

  private readonly proxy: IMainThreadToolbar;

  constructor(
    private extHostCommands: IExtHostCommands,
    private kaitianCommon: ExtHostCommon,
    private rpcProtocol: IRPCProtocol,
  ) {
    this.proxy = this.rpcProtocol.getProxy(MainThreadSumiAPIIdentifier.MainThreadToolbar);
  }

  async registerToolbarAction<T>(
    extensionId: string,
    extensionPath: string,
    contribution: IToolbarButtonContribution | IToolbarSelectContribution,
  ): Promise<IToolbarButtonActionHandle | IToolbarSelectActionHandle<T>> {
    if (contribution.type === 'button') {
      await this.proxy.$registerToolbarButtonAction(extensionId, extensionPath, contribution);
      return this.getToolbarButtonActionHandle(contribution.id, extensionId);
    }
    await this.proxy.$registerToolbarSelectAction(extensionId, extensionPath, contribution);
    return this.getToolbarSelectActionHandle(contribution.id, extensionId);
  }

  getToolbarButtonActionHandle(id: string, extensionId: string): Promise<IToolbarButtonActionHandle> {
    const compositeKey = extensionId + '.' + id;
    if (!this.btnHandles.has(compositeKey)) {
      const promise = new Promise<ToolbarBtnActionHandleController>(async (resolve, reject) => {
        const h = new ToolbarBtnActionHandleController(compositeKey, this.extHostCommands, this.kaitianCommon);
        try {
          await h.init();
          resolve(h);
        } catch (e) {
          reject(e);
        }
      });
      this.btnHandles.set(compositeKey, promise);
    }
    return this.btnHandles.get(compositeKey)!.then((h) => h.handle);
  }

  getToolbarSelectActionHandle<T = any>(id: string, extensionId: string): Promise<IToolbarSelectActionHandle<T>> {
    const compositeKey = extensionId + '.' + id;
    if (!this.selectHandles.has(compositeKey)) {
      const promise = new Promise<ToolbarSelectActionHandleController<T>>(async (resolve, reject) => {
        const h = new ToolbarSelectActionHandleController<T>(compositeKey, this.extHostCommands, this.kaitianCommon);
        try {
          await h.init();
          resolve(h);
        } catch (e) {
          reject(e);
        }
      });
      this.selectHandles.set(compositeKey, promise);
    }
    return this.selectHandles.get(compositeKey)!.then((h) => h.handle);
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
  ) {
    super();
  }

  get handle(): IToolbarButtonActionHandle {
    if (!this._handle) {
      this._handle = {
        onClick: this._onClick.event,
        onStateChanged: this._onStateChange.event,
        setState: (state, title?: string) =>
          this.extHostCommands.executeCommand<void>('sumi-extension.toolbar.btn.setState', this.id, state, title),
        showPopover: async (style?: IToolbarPopoverStyle) =>
          this.extHostCommands.executeCommand<void>('sumi-extension.toolbar.showPopover', this.id, style),
        hidePopover: async () =>
          this.extHostCommands.executeCommand<void>('sumi-extension.toolbar.hidePopover', this.id),
        /**
         * 由插件 API 负责更新的 context 对象
         * 在自定义 popover 场景下，该 context 对象会被序列化后从 popover 组件 props 传入
         * @param context {T}
         */
        setContext: <T>(context: T) =>
          this.extHostCommands.executeCommand<void>('sumi-extension.toolbar.btn.setContext', this.id, context),
      };
    }
    return this._handle;
  }

  async init() {
    this.addDispose(
      this.kaitianCommon.onEvent('sumi-extension.toolbar.btn.click', (id) => {
        if (id === this.id) {
          this._onClick.fire();
        }
      }),
    );
    this.addDispose(
      this.kaitianCommon.onEvent('sumi-extension.toolbar.btn.stateChange', (id, from, to) => {
        if (id === this.id) {
          this._onStateChange.fire({ from, to });
        }
      }),
    );
    return this.extHostCommands.executeCommand('sumi-extension.toolbar.btn.connectHandle', this.id);
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
          this.extHostCommands.executeCommand<void>('sumi-extension.toolbar.select.setState', this.id, state, title),
        setOptions: (options: any, iconBasePath?: string) =>
          this.extHostCommands.executeCommand<void>(
            'sumi-extension.toolbar.select.setOptions',
            this.id,
            iconBasePath,
            options,
          ),
        setSelect: (value: T) =>
          this.extHostCommands.executeCommand<void>('sumi-extension.toolbar.select.setSelect', this.id, value),
        getValue: () => this._value,
      };
    }
    return this._handle;
  }

  async init() {
    this.addDispose(
      this.kaitianCommon.onEvent('sumi-extension.toolbar.select.onSelect', (id, value) => {
        if (id === this.id) {
          this._onSelect.fire(value);
        }
      }),
    );
    this.addDispose(
      this.kaitianCommon.onEvent('sumi-extension.toolbar.select.stateChange', (id, from, to) => {
        if (id === this.id) {
          this._onStateChange.fire({ from, to });
        }
      }),
    );
    this._value = (await this.extHostCommands.executeCommand(
      'sumi-extension.toolbar.select.connectHandle',
      this.id,
    )) as T;
  }
}
