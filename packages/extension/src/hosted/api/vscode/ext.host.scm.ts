/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/plugin-ext/src/plugin/scm.ts

import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  asPromise,
  comparePaths,
  sortedDiff,
  debounce,
  Event,
  Emitter,
  getDebugLogger,
  DisposableStore,
  MutableDisposable,
  Uri as URI,
  UriComponents,
  CancellationToken,
  IDisposable,
} from '@opensumi/ide-core-common';
import { ISplice } from '@opensumi/ide-core-common/lib/sequence';

import { MainThreadAPIIdentifier, IExtensionDescription } from '../../../common/vscode';
import {
  SCMRawResourceSplices,
  SCMRawResource,
  SCMRawResourceSplice,
  IMainThreadSCMShape,
  IExtHostSCMShape,
  CommandDto,
} from '../../../common/vscode/scm';

import { ExtHostCommands } from './ext.host.command';

export type IMainContext = IRPCProtocol;

type ProviderHandle = number;
type GroupHandle = number;
type ResourceStateHandle = number;

function getIconPath(decorations?: vscode.SourceControlResourceThemableDecorations): string | undefined {
  if (!decorations) {
    return undefined;
  } else if (typeof decorations.iconPath === 'string') {
    return URI.file(decorations.iconPath).toString();
  } else if (decorations.iconPath) {
    return `${decorations.iconPath}`;
  }
  return undefined;
}

function compareResourceThemableDecorations(
  a: vscode.SourceControlResourceThemableDecorations,
  b: vscode.SourceControlResourceThemableDecorations,
): number {
  if (!a.iconPath && !b.iconPath) {
    return 0;
  } else if (!a.iconPath) {
    return -1;
  } else if (!b.iconPath) {
    return 1;
  }

  const aPath = typeof a.iconPath === 'string' ? a.iconPath : a.iconPath.fsPath;
  const bPath = typeof b.iconPath === 'string' ? b.iconPath : b.iconPath.fsPath;
  return comparePaths(aPath, bPath);
}

function compareResourceStatesDecorations(
  a: vscode.SourceControlResourceDecorations,
  b: vscode.SourceControlResourceDecorations,
): number {
  let result = 0;

  if (a.strikeThrough !== b.strikeThrough) {
    return a.strikeThrough ? 1 : -1;
  }

  if (a.faded !== b.faded) {
    return a.faded ? 1 : -1;
  }

  if (a.tooltip !== b.tooltip) {
    return (a.tooltip || '').localeCompare(b.tooltip || '');
  }

  result = compareResourceThemableDecorations(a, b);

  if (result !== 0) {
    return result;
  }

  if (a.light && b.light) {
    result = compareResourceThemableDecorations(a.light, b.light);
  } else if (a.light) {
    return 1;
  } else if (b.light) {
    return -1;
  }

  if (result !== 0) {
    return result;
  }

  if (a.dark && b.dark) {
    result = compareResourceThemableDecorations(a.dark, b.dark);
  } else if (a.dark) {
    return 1;
  } else if (b.dark) {
    return -1;
  }

  return result;
}

function compareResourceStates(a: vscode.SourceControlResourceState, b: vscode.SourceControlResourceState): number {
  let result = comparePaths(a.resourceUri.fsPath, b.resourceUri.fsPath, true);

  if (result !== 0) {
    return result;
  }

  if (a.decorations && b.decorations) {
    result = compareResourceStatesDecorations(a.decorations, b.decorations);
  } else if (a.decorations) {
    return 1;
  } else if (b.decorations) {
    return -1;
  }

  return result;
}

function compareArgs(a: any[], b: any[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function commandEquals(a: vscode.Command, b: vscode.Command): boolean {
  return (
    a.command === b.command &&
    a.title === b.title &&
    a.tooltip === b.tooltip &&
    (a.arguments && b.arguments ? compareArgs(a.arguments, b.arguments) : a.arguments === b.arguments)
  );
}

function commandListEquals(a: vscode.Command[], b: vscode.Command[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (!commandEquals(a[i], b[i])) {
      return false;
    }
  }

  return true;
}

export type IValidateInput = (
  value: string,
  cursorPosition: number,
) => vscode.ProviderResult<vscode.SourceControlInputBoxValidation | undefined | null>;

export class ExtHostSCMInputBox implements vscode.SourceControlInputBox {
  private _value = '';

  get value(): string {
    return this._value;
  }

  set value(value: string) {
    this._proxy.$setInputBoxValue(this._sourceControlHandle, value);
    this.updateValue(value);
  }

  private _onDidChange = new Emitter<string>();

  get onDidChange(): Event<string> {
    return this._onDidChange.event;
  }

  private _placeholder = '';

  get placeholder(): string {
    return this._placeholder;
  }

  set placeholder(placeholder: string) {
    this._proxy.$setInputBoxPlaceholder(this._sourceControlHandle, placeholder);
    this._placeholder = placeholder;
  }

  private _validateInput: IValidateInput;

  get validateInput(): IValidateInput {
    if (!this._extension.enableProposedApi) {
      throw new Error(
        `[${this._extension.id}]: Proposed API is only available when running out of dev or with the following command line switch: --enable-proposed-api ${this._extension.id}`,
      );
    }

    return this._validateInput;
  }

  set validateInput(fn: IValidateInput) {
    if (!this._extension.enableProposedApi) {
      throw new Error(
        `[${this._extension.id}]: Proposed API is only available when running out of dev or with the following command line switch: --enable-proposed-api ${this._extension.id}`,
      );
    }

    if (fn && typeof fn !== 'function') {
      getDebugLogger().warn('Invalid SCM input box validation function');
      return;
    }

    this._validateInput = fn;
    this._proxy.$setValidationProviderIsEnabled(this._sourceControlHandle, !!fn);
  }

  private _visible = true;

  get visible(): boolean {
    return this._visible;
  }

  set visible(visible: boolean) {
    visible = !!visible;
    this._visible = visible;
    this._proxy.$setInputBoxVisibility(this._sourceControlHandle, visible);
  }

  constructor(
    private _extension: IExtensionDescription,
    private _proxy: IMainThreadSCMShape,
    private _sourceControlHandle: number,
  ) {
    // noop
  }

  $onInputBoxValueChange(value: string): void {
    this.updateValue(value);
  }

  private updateValue(value: string): void {
    this._value = value;
    this._onDidChange.fire(value);
  }
}

class ExtHostSourceControlResourceGroup implements vscode.SourceControlResourceGroup {
  private static _handlePool = 0;
  private _resourceHandlePool = 0;
  private _resourceStates: vscode.SourceControlResourceState[] = [];

  private _resourceStatesMap: Map<ResourceStateHandle, vscode.SourceControlResourceState> = new Map<
    ResourceStateHandle,
    vscode.SourceControlResourceState
  >();
  private _resourceStatesCommandsMap: Map<ResourceStateHandle, vscode.Command> = new Map<
    ResourceStateHandle,
    vscode.Command
  >();
  private _resourceStatesDisposablesMap = new Map<ResourceStateHandle, IDisposable>();

  private _onDidUpdateResourceStates = new Emitter<void>();
  readonly onDidUpdateResourceStates = this._onDidUpdateResourceStates.event;
  private _onDidDispose = new Emitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  private _handlesSnapshot: number[] = [];
  private _resourceSnapshot: vscode.SourceControlResourceState[] = [];

  get id(): string {
    return this._id;
  }

  get label(): string {
    return this._label;
  }
  set label(label: string) {
    this._label = label;
    this._proxy.$updateGroupLabel(this._sourceControlHandle, this.handle, label);
  }

  private _hideWhenEmpty: boolean | undefined = undefined;
  get hideWhenEmpty(): boolean | undefined {
    return this._hideWhenEmpty;
  }
  set hideWhenEmpty(hideWhenEmpty: boolean | undefined) {
    this._hideWhenEmpty = hideWhenEmpty;
    this._proxy.$updateGroup(this._sourceControlHandle, this.handle, { hideWhenEmpty });
  }

  get resourceStates(): vscode.SourceControlResourceState[] {
    return [...this._resourceStates];
  }
  set resourceStates(resources: vscode.SourceControlResourceState[]) {
    this._resourceStates = [...resources];
    this._onDidUpdateResourceStates.fire();
  }

  readonly handle = ExtHostSourceControlResourceGroup._handlePool++;

  constructor(
    private _proxy: IMainThreadSCMShape,
    private _commands: ExtHostCommands,
    private _sourceControlHandle: number,
    private _id: string,
    private _label: string,
  ) {
    this._proxy.$registerGroup(_sourceControlHandle, this.handle, _id, _label);
  }

  getResourceState(handle: number): vscode.SourceControlResourceState | undefined {
    return this._resourceStatesMap.get(handle);
  }

  $executeResourceCommand(handle: number, preserveFocus: boolean): Promise<void> {
    const command = this._resourceStatesCommandsMap.get(handle);

    if (!command) {
      return Promise.resolve(undefined);
    }

    return asPromise(() => this._commands.executeCommand(command.command, ...(command.arguments || []), preserveFocus));
  }

  _takeResourceStateSnapshot(): SCMRawResourceSplice[] {
    const snapshot = [...this._resourceStates].sort(compareResourceStates);
    const diffs = sortedDiff(this._resourceSnapshot, snapshot, compareResourceStates);

    const splices = diffs.map<ISplice<{ rawResource: SCMRawResource; handle: number }>>((diff) => {
      const toInsert = diff.toInsert.map((r) => {
        const handle = this._resourceHandlePool++;
        this._resourceStatesMap.set(handle, r);

        const sourceUri = r.resourceUri;
        const iconPath = getIconPath(r.decorations);
        const lightIconPath = (r.decorations && getIconPath(r.decorations.light)) || iconPath;
        const darkIconPath = (r.decorations && getIconPath(r.decorations.dark)) || iconPath;
        const icons: string[] = [];
        let command: CommandDto | undefined;

        if (r.command) {
          if (r.command.command === 'vscode.open' || r.command.command === 'vscode.diff') {
            const disposables = new DisposableStore();
            command = this._commands.converter.toInternal(r.command, disposables);
            this._resourceStatesDisposablesMap.set(handle, disposables);
          } else {
            this._resourceStatesCommandsMap.set(handle, r.command);
          }
        }

        if (lightIconPath) {
          icons.push(lightIconPath);
        }

        if (darkIconPath && darkIconPath !== lightIconPath) {
          icons.push(darkIconPath);
        }

        const tooltip = (r.decorations && r.decorations.tooltip) || '';
        const strikeThrough = r.decorations && !!r.decorations.strikeThrough;
        const faded = r.decorations && !!r.decorations.faded;
        const contextValue = r.contextValue || '';

        const source = (r.decorations && r.decorations.source) || undefined;
        const letter = (r.decorations && r.decorations.letter) || undefined;
        const color = (r.decorations && r.decorations.color) || undefined;

        const rawResource = [
          handle,
          sourceUri as UriComponents,
          icons,
          tooltip,
          strikeThrough,
          faded,
          contextValue,
          command,
          source,
          letter,
          color /* 这三个属性后续要通过 File Decoration 实现 */,
        ] as SCMRawResource;

        return { rawResource, handle };
      });

      return { start: diff.start, deleteCount: diff.deleteCount, toInsert };
    });

    const rawResourceSplices = splices.map(
      ({ start, deleteCount, toInsert }) =>
        [start, deleteCount, toInsert.map((i) => i.rawResource)] as SCMRawResourceSplice,
    );

    const reverseSplices = splices.reverse();

    for (const { start, deleteCount, toInsert } of reverseSplices) {
      const handles = toInsert.map((i) => i.handle);
      const handlesToDelete = this._handlesSnapshot.splice(start, deleteCount, ...handles);

      for (const handle of handlesToDelete) {
        this._resourceStatesMap.delete(handle);
        this._resourceStatesCommandsMap.delete(handle);
      }
    }

    this._resourceSnapshot = snapshot;
    return rawResourceSplices;
  }

  dispose(): void {
    this._proxy.$unregisterGroup(this._sourceControlHandle, this.handle);
    this._onDidDispose.fire();
  }
}

class ExtHostSourceControl implements vscode.SourceControl {
  private static _handlePool = 0;
  private _groups: Map<GroupHandle, ExtHostSourceControlResourceGroup> = new Map<
    GroupHandle,
    ExtHostSourceControlResourceGroup
  >();

  get id(): string {
    return this._id;
  }

  get label(): string {
    return this._label;
  }

  get rootUri(): vscode.Uri | undefined {
    return this._rootUri;
  }

  private _inputBox: ExtHostSCMInputBox;
  get inputBox(): ExtHostSCMInputBox {
    return this._inputBox;
  }

  private _count: number | undefined = undefined;

  get count(): number | undefined {
    return this._count;
  }

  set count(count: number | undefined) {
    if (this._count === count) {
      return;
    }

    this._count = count;
    this._proxy.$updateSourceControl(this.handle, { count });
  }

  private _quickDiffProvider: vscode.QuickDiffProvider | undefined = undefined;

  get quickDiffProvider(): vscode.QuickDiffProvider | undefined {
    return this._quickDiffProvider;
  }

  set quickDiffProvider(quickDiffProvider: vscode.QuickDiffProvider | undefined) {
    this._quickDiffProvider = quickDiffProvider;
    this._proxy.$updateSourceControl(this.handle, { hasQuickDiffProvider: !!quickDiffProvider });
  }

  private _commitTemplate: string | undefined = undefined;

  get commitTemplate(): string | undefined {
    return this._commitTemplate;
  }

  set commitTemplate(commitTemplate: string | undefined) {
    this._commitTemplate = commitTemplate;
    this._proxy.$updateSourceControl(this.handle, { commitTemplate });
  }

  private _acceptInputDisposables = new MutableDisposable<DisposableStore>();
  private _acceptInputCommand: vscode.Command | undefined = undefined;

  get acceptInputCommand(): vscode.Command | undefined {
    return this._acceptInputCommand;
  }

  set acceptInputCommand(acceptInputCommand: vscode.Command | undefined) {
    this._acceptInputDisposables.value = new DisposableStore();

    this._acceptInputCommand = acceptInputCommand;

    const internal = this._commands.converter.toInternal(acceptInputCommand, this._acceptInputDisposables.value);
    this._proxy.$updateSourceControl(this.handle, { acceptInputCommand: internal });
  }

  private _statusBarDisposables = new MutableDisposable<DisposableStore>();
  private _statusBarCommands: vscode.Command[] | undefined = undefined;

  get statusBarCommands(): vscode.Command[] | undefined {
    return this._statusBarCommands;
  }

  set statusBarCommands(statusBarCommands: vscode.Command[] | undefined) {
    if (this._statusBarCommands && statusBarCommands && commandListEquals(this._statusBarCommands, statusBarCommands)) {
      return;
    }

    this._statusBarDisposables.value = new DisposableStore();

    this._statusBarCommands = statusBarCommands;

    const internal = (statusBarCommands || []).map((c) =>
      this._commands.converter.toInternal(c, this._statusBarDisposables.value!),
    ) as CommandDto[];
    this._proxy.$updateSourceControl(this.handle, { statusBarCommands: internal });
  }

  private _selected = false;

  get selected(): boolean {
    return this._selected;
  }

  private _onDidChangeSelection = new Emitter<boolean>();
  readonly onDidChangeSelection = this._onDidChangeSelection.event;

  private handle: number = ExtHostSourceControl._handlePool++;

  constructor(
    _extension: IExtensionDescription,
    private _proxy: IMainThreadSCMShape,
    private _commands: ExtHostCommands,
    private _id: string,
    private _label: string,
    private _rootUri?: vscode.Uri,
  ) {
    this._inputBox = new ExtHostSCMInputBox(_extension, this._proxy, this.handle);
    this._proxy.$registerSourceControl(this.handle, _id, _label, _rootUri);
  }

  private updatedResourceGroups = new Set<ExtHostSourceControlResourceGroup>();

  createResourceGroup(id: string, label: string): ExtHostSourceControlResourceGroup {
    const group = new ExtHostSourceControlResourceGroup(this._proxy, this._commands, this.handle, id, label);

    const updateListener = group.onDidUpdateResourceStates(() => {
      this.updatedResourceGroups.add(group);
      this.eventuallyUpdateResourceStates();
    });

    Event.once(group.onDidDispose)(() => {
      this.updatedResourceGroups.delete(group);
      updateListener.dispose();
      this._groups.delete(group.handle);
    });

    this._groups.set(group.handle, group);
    return group;
  }

  @debounce(100)
  eventuallyUpdateResourceStates(): void {
    const splices: SCMRawResourceSplices[] = [];

    this.updatedResourceGroups.forEach((group) => {
      const snapshot = group._takeResourceStateSnapshot();

      if (snapshot.length === 0) {
        return;
      }

      splices.push([group.handle, snapshot]);
    });

    if (splices.length > 0) {
      this._proxy.$spliceResourceStates(this.handle, splices);
    }

    this.updatedResourceGroups.clear();
  }

  getResourceGroup(handle: GroupHandle): ExtHostSourceControlResourceGroup | undefined {
    return this._groups.get(handle);
  }

  setSelectionState(selected: boolean): void {
    this._selected = selected;
    this._onDidChangeSelection.fire(selected);
  }

  dispose(): void {
    this._acceptInputDisposables.dispose();
    this._statusBarDisposables.dispose();

    this._groups.forEach((group) => group.dispose());
    this._proxy.$unregisterSourceControl(this.handle);
  }
}

export class ExtHostSCM implements IExtHostSCMShape {
  protected readonly logger = getDebugLogger();

  private static _handlePool = 0;

  private _proxy: IMainThreadSCMShape;
  private _sourceControls: Map<ProviderHandle, ExtHostSourceControl> = new Map<ProviderHandle, ExtHostSourceControl>();
  private _sourceControlsByExtension: Map<string, ExtHostSourceControl[]> = new Map<string, ExtHostSourceControl[]>();

  private _onDidChangeActiveProvider = new Emitter<vscode.SourceControl>();
  get onDidChangeActiveProvider(): Event<vscode.SourceControl> {
    return this._onDidChangeActiveProvider.event;
  }

  private _selectedSourceControlHandles = new Set<number>();

  constructor(rpc: IRPCProtocol, private _commands: ExtHostCommands) {
    this._proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadSCM);

    _commands.registerArgumentProcessor({
      processArgument: (arg) => {
        if (arg && arg.$mid === 3) {
          const sourceControl = this._sourceControls.get(arg.sourceControlHandle);

          if (!sourceControl) {
            return arg;
          }

          const group = sourceControl.getResourceGroup(arg.groupHandle);

          if (!group) {
            return arg;
          }

          return group.getResourceState(arg.handle);
        } else if (arg && arg.$mid === 4) {
          const sourceControl = this._sourceControls.get(arg.sourceControlHandle);

          if (!sourceControl) {
            return arg;
          }

          return sourceControl.getResourceGroup(arg.groupHandle);
        } else if (arg && arg.$mid === 5) {
          const sourceControl = this._sourceControls.get(arg.handle);

          if (!sourceControl) {
            return arg;
          }

          return sourceControl;
        }

        return arg;
      },
    });
  }

  createSourceControl(
    extension: IExtensionDescription,
    id: string,
    label: string,
    rootUri: vscode.Uri | undefined,
  ): vscode.SourceControl {
    this.logger.log('ExtHostSCM#createSourceControl', extension.id, id, label, rootUri);

    const handle = ExtHostSCM._handlePool++;
    const sourceControl = new ExtHostSourceControl(extension, this._proxy, this._commands, id, label, rootUri);
    this._sourceControls.set(handle, sourceControl);

    const sourceControls = this._sourceControlsByExtension.get(extension.id) || [];
    sourceControls.push(sourceControl);
    this._sourceControlsByExtension.set(extension.id, sourceControls);

    return sourceControl;
  }

  // Deprecated
  getLastInputBox(extension: IExtensionDescription): ExtHostSCMInputBox | undefined {
    this.logger.log('ExtHostSCM#getLastInputBox', extension.id);

    const sourceControls = this._sourceControlsByExtension.get(extension.id);
    const sourceControl = sourceControls && sourceControls[sourceControls.length - 1];
    return sourceControl && sourceControl.inputBox;
  }

  $provideOriginalResource(
    sourceControlHandle: number,
    uriComponents: UriComponents,
    token: CancellationToken,
  ): Promise<UriComponents | null> {
    const uri = URI.revive(uriComponents);
    this.logger.log('ExtHostSCM#$provideOriginalResource', sourceControlHandle, uri.toString());

    const sourceControl = this._sourceControls.get(sourceControlHandle);

    if (
      !sourceControl ||
      !sourceControl.quickDiffProvider ||
      !sourceControl.quickDiffProvider.provideOriginalResource
    ) {
      return Promise.resolve(null);
    }

    return asPromise(() =>
      sourceControl.quickDiffProvider!.provideOriginalResource!(uri, token),
    ).then<UriComponents | null>((r) => r || null);
  }

  $onInputBoxValueChange(sourceControlHandle: number, value: string): Promise<void> {
    this.logger.log('ExtHostSCM#$onInputBoxValueChange', sourceControlHandle);

    const sourceControl = this._sourceControls.get(sourceControlHandle);

    if (!sourceControl) {
      return Promise.resolve(undefined);
    }

    sourceControl.inputBox.$onInputBoxValueChange(value);
    return Promise.resolve(undefined);
  }

  $executeResourceCommand(
    sourceControlHandle: number,
    groupHandle: number,
    handle: number,
    preserveFocus: boolean,
  ): Promise<void> {
    this.logger.log('ExtHostSCM#$executeResourceCommand', sourceControlHandle, groupHandle, handle);

    const sourceControl = this._sourceControls.get(sourceControlHandle);

    if (!sourceControl) {
      return Promise.resolve(undefined);
    }

    const group = sourceControl.getResourceGroup(groupHandle);

    if (!group) {
      return Promise.resolve(undefined);
    }

    return group.$executeResourceCommand(handle, preserveFocus);
  }

  $validateInput(
    sourceControlHandle: number,
    value: string,
    cursorPosition: number,
  ): Promise<[string, number] | undefined> {
    this.logger.log('ExtHostSCM#$validateInput', sourceControlHandle);

    const sourceControl = this._sourceControls.get(sourceControlHandle);

    if (!sourceControl) {
      return Promise.resolve(undefined);
    }

    if (!sourceControl.inputBox.validateInput) {
      return Promise.resolve(undefined);
    }

    return asPromise(() => sourceControl.inputBox.validateInput(value, cursorPosition)).then((result) => {
      if (!result) {
        return Promise.resolve(undefined);
      }

      return Promise.resolve<[string, number]>([result.message, result.type]);
    });
  }

  $setSelectedSourceControls(selectedSourceControlHandles: number[]): Promise<void> {
    this.logger.log('ExtHostSCM#$setSelectedSourceControls', selectedSourceControlHandles);

    const set = new Set<number>();

    for (const handle of selectedSourceControlHandles) {
      set.add(handle);
    }

    set.forEach((handle) => {
      if (!this._selectedSourceControlHandles.has(handle)) {
        const sourceControl = this._sourceControls.get(handle);

        if (!sourceControl) {
          return;
        }

        sourceControl.setSelectionState(true);
      }
    });

    this._selectedSourceControlHandles.forEach((handle) => {
      if (!set.has(handle)) {
        const sourceControl = this._sourceControls.get(handle);

        if (!sourceControl) {
          return;
        }

        sourceControl.setSelectionState(false);
      }
    });

    this._selectedSourceControlHandles = set;
    return Promise.resolve(undefined);
  }
}
