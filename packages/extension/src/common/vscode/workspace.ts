import type vscode from 'vscode';

import { URI, IDisposable, IRange, CancellationToken } from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-file-service';
// eslint-disable-next-line import/no-restricted-paths
import type { EndOfLineSequence } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { IWorkspaceEdit, IResourceTextEdit, IResourceFileEdit } from '@opensumi/ide-workspace-edit';

import { Uri, UriComponents } from './ext-types';
import type * as model from './model.api';

export interface IMainThreadWorkspace extends IDisposable {
  $saveAll(): Promise<boolean>;
  $tryApplyWorkspaceEdit(dto: model.WorkspaceEditDto): Promise<boolean>;
  $updateWorkspaceFolders(
    start: number,
    deleteCount?: number,
    workspaceToName?: { [key: string]: string },
    ...rootsToAdd: string[]
  ): Promise<void>;
  $startFileSearch(
    includePattern: string,
    options: { cwd?: string; absolute: boolean },
    excludePatternOrDisregardExcludes: string | false | undefined,
    maxResult: number | undefined,
    token: CancellationToken,
  ): Promise<string[]>;
}

export interface IExtHostWorkspace {
  getWorkspaceFolder(uri: Uri, resolveParent?: boolean): vscode.WorkspaceFolder | undefined;
  resolveWorkspaceFolder(): vscode.WorkspaceFolder[] | undefined;
  $onWorkspaceFoldersChanged(event: WorkspaceRootsChangeEvent): void;
  $didRenameFile(oldUri: UriComponents, newUri: UriComponents): Promise<void>;
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
  inspect<T>(
    section: string,
  ): { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T; workspaceFolderValue?: T } | undefined;

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

export interface ITextEdit {
  range: IRange;
  text: string;
  eol?: EndOfLineSequence;
}

export function reviveWorkspaceEditDto(data: model.WorkspaceEditDto | undefined): IWorkspaceEdit {
  if (data && data.edits) {
    for (const edit of data.edits) {
      if (typeof (edit as model.ResourceTextEditDto).resource === 'object') {
        (edit as unknown as IResourceTextEdit).resource = URI.from((edit as model.ResourceTextEditDto).resource);
        (edit as unknown as IResourceTextEdit).options = { openDirtyInEditor: true };
        (edit as unknown as IResourceTextEdit).textEdit = (edit as model.ResourceTextEditDto).edit;
        (edit as unknown as IResourceTextEdit).versionId = (edit as model.ResourceTextEditDto).modelVersionId;
      } else {
        const resourceFileEdit = edit as unknown as IResourceFileEdit;
        resourceFileEdit.newResource = (edit as model.ResourceFileEditDto).newUri
          ? URI.from((edit as model.ResourceFileEditDto).newUri!)
          : undefined;
        resourceFileEdit.oldResource = (edit as model.ResourceFileEditDto).oldUri
          ? URI.from((edit as model.ResourceFileEditDto).oldUri!)
          : undefined;
        // 似乎 vscode 的行为默认不会 showInEditor，参考来自 codeMe 插件
        resourceFileEdit.options = {
          ...resourceFileEdit.options,
          showInEditor: false,
        };
      }
    }
  }
  return data as unknown as IWorkspaceEdit;
}
