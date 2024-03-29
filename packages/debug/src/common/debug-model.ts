import stream from 'stream';

import {
  BinaryBuffer,
  Disposable,
  Emitter,
  Event,
  IDisposable,
  IJSONSchema,
  IJSONSchemaSnippet,
  MaybePromise,
  URI,
  decodeBase64,
  encodeBase64,
} from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';

import {
  DebugBreakpointWidgetContext,
  IRuntimeBreakpoint,
  ISourceBreakpoint,
  TSourceBrekpointProperties,
} from './debug-breakpoint';
import { DebugConfiguration } from './debug-configuration';
import { DebugEditor } from './debug-editor';
import { IDebugHoverWidget } from './debug-hover';
import { IMemoryInvalidationEvent, IMemoryRegion, MemoryRange, MemoryRangeType } from './debug-service';
import { IDebugSession } from './debug-session';

export interface IDebugBreakpointWidget extends IDisposable {
  position: monaco.Position | undefined;
}

export const DebugAdapterSession = Symbol('DebugAdapterSession');

export interface DebugAdapterSession {
  id: string;
  start(channel: any): Promise<void>;
  stop(): Promise<void>;
}

export const DebugAdapterSessionFactory = Symbol('DebugAdapterSessionFactory');

export interface DebugAdapterSessionFactory {
  get(sessionId: string, communicationProvider: DebugStreamConnection): DebugAdapterSession;
}

export interface DebugAdapterSpawnExecutable {
  command: string;
  args?: string[];
}

export interface DebugAdapterForkExecutable {
  modulePath: string;
  args?: string[];
}

/**
 * 可执行的调试适配器类型
 * 用于实例化调试适配器的参数
 *
 * 在Launch适配器进程的情况下，参数包含命令和参数。例如：
 * {'command' : 'COMMAND_TO_LAUNCH_DEBUG_ADAPTER', args : [ { 'arg1', 'arg2' } ] }
 *
 * 在Fork适配器进程的情况下，包含要转换的modulePath。例如：
 * {'modulePath' : 'NODE_COMMAND_TO_LAUNCH_DEBUG_ADAPTER', args : [ { 'arg1', 'arg2' } ] }
 */
export type DebugAdapterExecutable = DebugAdapterSpawnExecutable | DebugAdapterForkExecutable;

/**
 * 与调试进程的通讯渠道
 */
export interface DebugStreamConnection extends IDisposable {
  output: stream.Readable;
  input: stream.Writable;
}

export const DebugAdapterFactory = Symbol('DebugAdapterFactory');

export interface DebugAdapterFactory {
  start(executable: DebugAdapterExecutable): DebugStreamConnection;
  connect(debugServerPort: number): DebugStreamConnection;
}

export const DebugAdapterContribution = Symbol('DebugAdapterContribution');

export interface DebugAdapterContribution {
  /**
   * The debug type. Should be a unique value among all debug adapters.
   */
  readonly type: string;

  readonly label?: MaybePromise<string | undefined>;

  readonly languages?: MaybePromise<string[] | undefined>;

  /**
   * The [debug adapter session](#DebugAdapterSession) factory.
   * If a default implementation of the debug adapter session does not
   * fit all needs it is possible to provide its own implementation using
   * this factory. But it is strongly recommended to extend the default
   * implementation if so.
   */
  debugAdapterSessionFactory?: DebugAdapterSessionFactory;

  /**
   * @returns The contributed configuration schema for this debug type.
   */
  getSchemaAttributes?(): MaybePromise<IJSONSchema[]>;

  getConfigurationSnippets?(): MaybePromise<IJSONSchemaSnippet[]>;

  /**
   * Provides a [debug adapter executable](#DebugAdapterExecutable)
   * based on [debug configuration](#DebugConfiguration) to launch a new debug adapter
   * or to connect to existed one.
   * @param config The resolved [debug configuration](#DebugConfiguration).
   * @returns The [debug adapter executable](#DebugAdapterExecutable).
   */
  provideDebugAdapterExecutable?(config: DebugConfiguration): MaybePromise<DebugAdapterExecutable | undefined>;

  /**
   * Provides initial [debug configuration](#DebugConfiguration).
   * @returns An array of [debug configurations](#DebugConfiguration).
   */
  provideDebugConfigurations?(workspaceFolderUri?: string): MaybePromise<DebugConfiguration[]>;

  /**
   * Resolves a [debug configuration](#DebugConfiguration) by filling in missing values
   * or by adding/changing/removing attributes.
   * @param config The [debug configuration](#DebugConfiguration) to resolve.
   * @returns The resolved debug configuration.
   */
  resolveDebugConfiguration?(
    config: DebugConfiguration,
    workspaceFolderUri?: string,
  ): MaybePromise<DebugConfiguration | undefined>;
}

export const DebugModelFactory = Symbol('DebugModelFactory');
export type DebugModelFactory = (editor: DebugEditor) => IDebugModel;

export const IDebugModel = Symbol('IDebugModel');
export interface IDebugModel extends IDisposable {
  uri: URI;
  position: monaco.Position;
  init: () => Promise<void>;
  renderBreakpoints: () => void;
  toggleBreakpoint: (position?: monaco.Position) => void;
  openBreakpointView: (
    position: monaco.Position,
    context?: DebugBreakpointWidgetContext,
    defaultContext?: TSourceBrekpointProperties,
  ) => void;
  closeBreakpointView: () => void;
  acceptBreakpoint: () => void;
  focusStackFrame: () => void;
  breakpoint: ISourceBreakpoint | IRuntimeBreakpoint | undefined;
  onContextMenu: (event: monaco.editor.IEditorMouseEvent | monaco.editor.IPartialEditorMouseEvent) => void;
  onMouseDown: (event: monaco.editor.IEditorMouseEvent | monaco.editor.IPartialEditorMouseEvent) => void;
  onMouseMove: (event: monaco.editor.IEditorMouseEvent | monaco.editor.IPartialEditorMouseEvent) => void;
  onMouseLeave: (event: monaco.editor.IEditorMouseEvent | monaco.editor.IPartialEditorMouseEvent) => void;
  getBreakpoints(
    uri?: URI | undefined,
    filter?: Partial<monaco.IPosition> | undefined,
  ): Array<ISourceBreakpoint | IRuntimeBreakpoint>;
  getEditor: () => DebugEditor;
  getBreakpointWidget: () => IDebugBreakpointWidget;
  getDebugHoverWidget: () => IDebugHoverWidget;
  render: () => void;
}

export class MemoryRegion extends Disposable implements IMemoryRegion {
  private readonly invalidateEmitter = this.registerDispose(new Emitter<IMemoryInvalidationEvent>());

  /** @inheritdoc */
  public readonly onDidInvalidate = this.invalidateEmitter.event;

  /** @inheritdoc */
  public readonly writable = !!this.session.capabilities.supportsWriteMemoryRequest;

  constructor(private readonly memoryReference: string, private readonly session: IDebugSession) {
    super();
    this.registerDispose(
      session.onDidInvalidateMemory((e) => {
        if (e.body.memoryReference === memoryReference) {
          this.invalidate(e.body.offset, e.body.count - e.body.offset);
        }
      }),
    );
  }

  public async read(fromOffset: number, toOffset: number): Promise<MemoryRange[]> {
    const length = toOffset - fromOffset;
    const offset = fromOffset;
    const result = await this.session.readMemory(this.memoryReference, offset, length);

    if (result === undefined || !result.body?.data) {
      return [{ type: MemoryRangeType.Unreadable, offset, length }];
    }

    let data: BinaryBuffer;
    try {
      data = decodeBase64(result.body.data);
    } catch (e) {
      return [{ type: MemoryRangeType.Error, offset, length, error: e.message }];
    }

    const unreadable = result.body.unreadableBytes || 0;
    const dataLength = length - unreadable;
    if (data.byteLength < dataLength) {
      const pad = BinaryBuffer.alloc(dataLength - data.byteLength);
      pad.buffer.fill(0);
      data = BinaryBuffer.concat([data, pad], dataLength);
    } else if (data.byteLength > dataLength) {
      data = data.slice(0, dataLength);
    }

    if (!unreadable) {
      return [{ type: MemoryRangeType.Valid, offset, length, data }];
    }

    return [
      { type: MemoryRangeType.Valid, offset, length: dataLength, data },
      { type: MemoryRangeType.Unreadable, offset: offset + dataLength, length: unreadable },
    ];
  }

  public async write(offset: number, data: BinaryBuffer): Promise<number> {
    const result = await this.session.writeMemory(this.memoryReference, offset, encodeBase64(data), true);
    const written = result?.body?.bytesWritten ?? data.byteLength;
    this.invalidate(offset, offset + written);
    return written;
  }

  public override dispose() {
    super.dispose();
  }

  private invalidate(fromOffset: number, toOffset: number) {
    this.invalidateEmitter.fire({ fromOffset, toOffset });
  }
}

export enum DebugModelSupportedEventType {
  down = 'Down',
  move = 'Move',
  leave = 'Leave',
  contextMenu = 'contextMenu',
}

export const IDebugModelManager = Symbol('DebugModelManager');

export interface IDebugModelManager {
  init(session?: IDebugSession): void;
  model: IDebugModel | undefined;
  resolve(uri: URI): IDebugModel[] | undefined;
  handleMouseEvent(
    uri: URI,
    type: DebugModelSupportedEventType,
    event: monaco.editor.IEditorMouseEvent | monaco.editor.IPartialEditorMouseEvent,
    monacoEditor: any,
  ): void;
  onModelChanged: Event<monaco.editor.IModelChangedEvent>;
}
