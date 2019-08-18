import * as vscode from 'vscode';
import { IDisposable, IRange } from '@ali/ide-core-common';
import { Uri, UriComponents} from './ext-types';
import { FileStat } from '@ali/ide-file-service';
import { illegalArgument } from '@ali/ide-core-common/lib/errors';
import { EndOfLineSequence } from '@ali/ide-editor/lib/common';

export interface IMainThreadWorkspace extends IDisposable {
  $tryApplyWorkspaceEdit(dto: WorkspaceEditDto): Promise<boolean>;
  $updateWorkspaceFolders(start: number, deleteCount?: number, ...rootsToAdd: string[]): Promise<void>;
}

export interface IExtHostWorkspace {
  getWorkspaceFolder(uri: Uri, resolveParent?: boolean): vscode.WorkspaceFolder | undefined;
  $onWorkspaceFoldersChanged(event: WorkspaceRootsChangeEvent): void;
}

export interface WorkspaceConfiguration {

  /**
   * Return a value from this configuration.
   *
   * @param section Configuration name, supports _dotted_ names.
   * @return The value `section` denotes or `undefined`.
   */
  get<T>(section: string): T | undefined;

  /**
   * Return a value from this configuration.
   *
   * @param section Configuration name, supports _dotted_ names.
   * @param defaultValue A value should be returned when no value could be found, is `undefined`.
   * @return The value `section` denotes or the default.
   */
  get<T>(section: string, defaultValue: T): T;

  /**
   * Check if this configuration has a certain value.
   *
   * @param section Configuration name, supports _dotted_ names.
   * @return `true` if the section doesn't resolve to `undefined`.
   */
  has(section: string): boolean;

  /**
   * Retrieve all information about a configuration setting. A configuration value
   * often consists of a *default* value, a global or installation-wide value,
   * a workspace-specific value and a folder-specific value.
   *
   * The *effective* value (returned by [`get`](#WorkspaceConfiguration.get))
   * is computed like this: `defaultValue` overwritten by `globalValue`,
   * `globalValue` overwritten by `workspaceValue`. `workspaceValue` overwritten by `workspaceFolderValue`.
   * Refer to [Settings Inheritance](https://code.visualstudio.com/docs/getstarted/settings)
   * for more information.
   *
   * *Note:* The configuration name must denote a leaf in the configuration tree
   * (`editor.fontSize` vs `editor`) otherwise no result is returned.
   *
   * @param section Configuration name, supports _dotted_ names.
   * @return Information about a configuration setting or `undefined`.
   */
  inspect<T>(section: string): { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T, workspaceFolderValue?: T } | undefined;

  /**
   * Update a configuration value. The updated configuration values are persisted.
   *
   * A value can be changed in
   *
   * - [Global configuration](#ConfigurationTarget.Global): Changes the value for all instances of the editor.
   * - [Workspace configuration](#ConfigurationTarget.Workspace): Changes the value for current workspace, if available.
   * - [Workspace folder configuration](#ConfigurationTarget.WorkspaceFolder): Changes the value for the
   * [Workspace folder](#workspace.workspaceFolders) to which the current [configuration](#WorkspaceConfiguration) is scoped to.
   *
   * *Note 1:* Setting a global value in the presence of a more specific workspace value
   * has no observable effect in that workspace, but in others. Setting a workspace value
   * in the presence of a more specific folder value has no observable effect for the resources
   * under respective [folder](#workspace.workspaceFolders), but in others. Refer to
   * [Settings Inheritance](https://code.visualstudio.com/docs/getstarted/settings) for more information.
   *
   * *Note 2:* To remove a configuration value use `undefined`, like so: `config.update('somekey', undefined)`
   *
   * Will throw error when
   * - Writing a configuration which is not registered.
   * - Writing a configuration to workspace or folder target when no workspace is opened
   * - Writing a configuration to folder target when there is no folder settings
   * - Writing to folder target without passing a resource when getting the configuration (`workspace.getConfiguration(section, resource)`)
   * - Writing a window configuration to folder target
   *
   * @param section Configuration name, supports _dotted_ names.
   * @param value The new value.
   * @param configurationTarget The [configuration target](#ConfigurationTarget) or a boolean value.
   *	- If `true` configuration target is `ConfigurationTarget.Global`.
   *	- If `false` configuration target is `ConfigurationTarget.Workspace`.
   *	- If `undefined` or `null` configuration target is
   *	`ConfigurationTarget.WorkspaceFolder` when configuration is resource specific
   *	`ConfigurationTarget.Workspace` otherwise.
   */
  update(section: string, value: any, configurationTarget?: ConfigurationTarget | boolean): Thenable<void>;

  /**
   * Readable dictionary that backs this configuration.
   */
  readonly [key: string]: any;
}

/**
 * The configuration target
 */
export enum ConfigurationTarget {
  /**
   * Global configuration
  */
  Global = 1,

  /**
   * Workspace configuration
   */
  Workspace = 2,

  /**
   * Workspace folder configuration
   */
  WorkspaceFolder = 3,
}

export interface WorkspaceRootsChangeEvent {
  roots: FileStat[];
}

export interface WorkspaceEditDto {
  edits: Array<ResourceFileEditDto | ResourceTextEditDto>;

  // todo@joh reject should go into rename
  rejectReason?: string;
}

export interface ResourceFileEditDto {
  oldUri?: UriComponents;
  newUri?: UriComponents;
  options?: {
    overwrite?: boolean;
    ignoreIfExists?: boolean;
    ignoreIfNotExists?: boolean;
    recursive?: boolean;
  };
}

export interface ResourceTextEditDto {
  resource: UriComponents;
  modelVersionId?: number;
  edits: ITextEdit[];
}

export interface ITextEdit { range: IRange; text: string; eol?: EndOfLineSequence; }
