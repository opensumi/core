import stream from 'stream';

import { IDisposable, MaybePromise, IJSONSchema, IJSONSchemaSnippet, URI } from '@opensumi/ide-core-common';
import type { editor } from '@opensumi/monaco-editor-core';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  IRuntimeBreakpoint,
  ISourceBreakpoint,
  DebugBreakpointWidgetContext,
  TSourceBrekpointProperties,
} from './debug-breakpoint';
import { DebugConfiguration } from './debug-configuration';
import { DebugEditor } from './debug-editor';
import { IDebugHoverWidget } from './debug-hover';

export interface IDebugBreakpointWidget extends IDisposable {
  position: monaco.Position | undefined;
}

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
  onContextMenu: (event: editor.IEditorMouseEvent | editor.IPartialEditorMouseEvent) => void;
  onMouseDown: (event: editor.IEditorMouseEvent | editor.IPartialEditorMouseEvent) => void;
  onMouseMove: (event: editor.IEditorMouseEvent | editor.IPartialEditorMouseEvent) => void;
  onMouseLeave: (event: editor.IEditorMouseEvent | editor.IPartialEditorMouseEvent) => void;
  getBreakpoints(
    uri?: URI | undefined,
    filter?: Partial<monaco.IPosition> | undefined,
  ): Array<ISourceBreakpoint | IRuntimeBreakpoint>;
  getEditor: () => DebugEditor;
  getBreakpointWidget: () => IDebugBreakpointWidget;
  getDebugHoverWidget: () => IDebugHoverWidget;
  render: () => void;
}
