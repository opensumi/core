import { Event, OS } from '@opensumi/ide-core-common';
import { IProcessEnvironment } from '@opensumi/ide-core-common/lib/platform';

export const EnvironmentVariableServiceToken = Symbol(
  'EnvironmentVariableServiceToken',
);

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Some code copued and modified from
 * https://github.com/microsoft/vscode/blob/1.55.0/src/vs/workbench/contrib/terminal/common/environmentVariable.ts
 * https://github.com/microsoft/vscode/blob/1.55.0/src/vs/platform/terminal/common/environmentVariable.ts
 */

export interface IEnvironmentVariableCollection {
  readonly map: ReadonlyMap<string, IEnvironmentVariableMutator>;
}

export interface IEnvironmentVariableCollectionWithPersistence extends IEnvironmentVariableCollection {
  readonly persistent: boolean;
}

export interface IExtensionOwnedEnvironmentVariableMutator
  extends IEnvironmentVariableMutator {
  readonly extensionIdentifier: string;
}

export interface IMergedEnvironmentVariableCollectionDiff {
  added: ReadonlyMap<string, IExtensionOwnedEnvironmentVariableMutator[]>;
  changed: ReadonlyMap<string, IExtensionOwnedEnvironmentVariableMutator[]>;
  removed: ReadonlyMap<string, IExtensionOwnedEnvironmentVariableMutator[]>;
}

/**
 * Represents an environment variable collection that results from merging several collections
 * together.
 */
export interface IMergedEnvironmentVariableCollection {
  readonly map: ReadonlyMap<
    string,
    IExtensionOwnedEnvironmentVariableMutator[]
  >;

  /**
   * Applies this collection to a process environment.
   * @param variableResolver An optional function to use to resolve variables within the
   * environment values.
   */
  applyToProcessEnvironment(
    env: IProcessEnvironment,
    os: OS.Type,
    variableResolver?: (str: string) => PromiseLike<string>,
  ): Promise<void>;

  /**
   * Generates a diff of this connection against another. Returns undefined if the collections are
   * the same.
   */
  diff(
    other: IMergedEnvironmentVariableCollection,
  ): IMergedEnvironmentVariableCollectionDiff | undefined;
}

export interface IEnvironmentVariableService {

  initEnvironmentVariableCollections(): Promise<void>;

  /**
   * Gets a single collection constructed by merging all environment variable collections into
   * one.
   */
  readonly collections: ReadonlyMap<string, IEnvironmentVariableCollection>;

  /**
   * Gets a single collection constructed by merging all environment variable collections into
   * one.
   */
  readonly mergedCollection: IMergedEnvironmentVariableCollection | undefined;

  /**
   * An event that is fired when an extension's environment variable collection changes, the event
   * provides the new merged collection.
   */
  onDidChangeCollections: Event<IMergedEnvironmentVariableCollection>;

  /**
   * Sets an extension's environment variable collection.
   */
  set(
    extensionIdentifier: string,
    collection: IEnvironmentVariableCollection,
  ): void;

  /**
   * Deletes an extension's environment variable collection.
   */
  delete(extensionIdentifier: string): void;
}

export interface EnvironmentVariableCollection {
  readonly map: ReadonlyMap<string, EnvironmentVariableMutator>;
}

export interface EnvironmentVariableCollectionWithPersistence
  extends EnvironmentVariableCollection {
  readonly persistent: boolean;
}

export function mutatorTypeLabel(type: EnvironmentVariableMutatorType, value: string, variable: string): string {
  switch (type) {
    case EnvironmentVariableMutatorType.Prepend: return `${variable}=${value}\${env:${variable}}`;
    case EnvironmentVariableMutatorType.Append: return `${variable}=\${env:${variable}}${value}`;
    default: return `${variable}=${value}`;
  }
}

export enum EnvironmentVariableMutatorType {
  Replace = 1,
  Append = 2,
  Prepend = 3,
}

export interface EnvironmentVariableMutator {
  readonly value: string;
  readonly type: EnvironmentVariableMutatorType;
}

export interface ExtensionOwnedEnvironmentVariableMutator
  extends EnvironmentVariableMutator {
  readonly extensionIdentifier: string;
}

/**
 * Represents an environment variable collection that results from merging several collections
 * together.
 */
export interface MergedEnvironmentVariableCollection {
  readonly map: ReadonlyMap<string, ExtensionOwnedEnvironmentVariableMutator[]>;

  /**
   * Applies this collection to a process environment.
   */
  applyToProcessEnvironment(env: { [key: string]: string | null }): void;
}

export interface SerializableExtensionEnvironmentVariableCollection {
  extensionIdentifier: string;
  collection: SerializableEnvironmentVariableCollection;
}

export type SerializableEnvironmentVariableCollection = [
  string,
  EnvironmentVariableMutator
][];

export interface IEnvironmentVariableMutator {
  readonly value: string;
  readonly type: EnvironmentVariableMutatorType;
}

/** [variable, mutator] */
export type ISerializableEnvironmentVariableCollection = [
  string,
  IEnvironmentVariableMutator
][];

export function serializeEnvironmentVariableCollection(
  collection: ReadonlyMap<string, IEnvironmentVariableMutator>,
): SerializableEnvironmentVariableCollection {
  return [...collection.entries()];
}

export function deserializeEnvironmentVariableCollection(
  serializedCollection: SerializableEnvironmentVariableCollection,
): Map<string, IEnvironmentVariableMutator> {
  return new Map<string, IEnvironmentVariableMutator>(serializedCollection);
}
