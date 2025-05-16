import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { ILogger } from '@opensumi/ide-core-browser';
import {
  CancellationToken,
  Disposable,
  Emitter,
  Event,
  IDisposable,
  ISplice,
  Sequence,
  Uri as URI,
  UriComponents,
} from '@opensumi/ide-core-common';
import {
  IInputValidation,
  ISCMActionButtonDescriptor,
  ISCMHistoryItem,
  ISCMHistoryItemChange,
  ISCMHistoryItemGroup,
  ISCMHistoryOptions,
  ISCMHistoryProvider,
  ISCMProvider,
  ISCMRepository,
  ISCMResource,
  ISCMResourceDecorations,
  ISCMResourceGroup,
  SCMService,
} from '@opensumi/ide-scm/lib/common';

import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { VSCommand } from '../../../common/vscode/model.api';
import {
  IExtHostSCMShape,
  IMainThreadSCMShape,
  SCMActionButtonDto,
  SCMGroupFeatures,
  SCMHistoryItemDto,
  SCMHistoryItemGroupDto,
  SCMInputActionButtonDto,
  SCMProviderFeatures,
  SCMRawResourceSplices,
} from '../../../common/vscode/scm';

import type vscode from 'vscode';

class MainThreadSCMResourceGroup implements ISCMResourceGroup {
  readonly elements: ISCMResource[] = [];

  private _onDidSplice = new Emitter<ISplice<ISCMResource>>();
  readonly onDidSplice = this._onDidSplice.event;

  get hideWhenEmpty(): boolean {
    return !!this.features.hideWhenEmpty;
  }

  private _onDidChange = new Emitter<void>();
  readonly onDidChange: Event<void> = this._onDidChange.event;

  constructor(
    private readonly sourceControlHandle: number,
    private readonly handle: number,
    public provider: ISCMProvider,
    public features: SCMGroupFeatures,
    public label: string,
    public id: string,
  ) {}

  toJSON() {
    return {
      $mid: 4,
      sourceControlHandle: this.sourceControlHandle,
      groupHandle: this.handle,
    };
  }

  splice(start: number, deleteCount: number, toInsert: ISCMResource[]) {
    // 部分情况下 SCM Provider 会重复调用该方法，导致 elements 被重复添加，导致重复渲染
    // 所以这里需要先判断 toInsert 是否已经在 elements 中，如果不在，则添加，否则不添加
    const uniqueResourcesToInsert: ISCMResource[] = [];
    for (const resource of toInsert) {
      const hasInserted = this.elements.some(
        (r) =>
          r.sourceUri.toString() === resource.sourceUri.toString() && r.resourceGroup.id === resource.resourceGroup.id,
      );
      if (!hasInserted) {
        uniqueResourcesToInsert.push(resource);
      }
    }
    if (uniqueResourcesToInsert.length > 0) {
      this.elements.splice(start, deleteCount, ...uniqueResourcesToInsert);
      this._onDidSplice.fire({ start, deleteCount, toInsert: uniqueResourcesToInsert });
    }
  }

  $updateGroup(features: SCMGroupFeatures): void {
    this.features = Object.assign(this.features, features);
    this._onDidChange.fire();
  }

  $updateGroupLabel(label: string): void {
    this.label = label;
    this._onDidChange.fire();
  }
}

class MainThreadSCMResource implements ISCMResource {
  constructor(
    private readonly proxy: IExtHostSCMShape,
    private readonly sourceControlHandle: number,
    private readonly groupHandle: number,
    private readonly handle: number,
    public readonly sourceUri: URI,
    public readonly resourceGroup: ISCMResourceGroup,
    public readonly decorations: ISCMResourceDecorations,
    public readonly contextValue: string | undefined,
    public readonly command: VSCommand | undefined,
  ) {}

  open(preserveFocus: boolean): Promise<void> {
    return this.proxy.$executeResourceCommand(this.sourceControlHandle, this.groupHandle, this.handle, preserveFocus);
  }

  toJSON() {
    return {
      $mid: 3,
      sourceControlHandle: this.sourceControlHandle,
      groupHandle: this.groupHandle,
      handle: this.handle,
    };
  }
}

function getSCMHistoryItemIcon(historyItem: SCMHistoryItemDto): URI | { light: URI; dark: URI } | undefined {
  if (!historyItem.icon) {
    return undefined;
  } else if (URI.isUri(historyItem.icon)) {
    return URI.revive(historyItem.icon);
  } else {
    const icon = historyItem.icon as { light: UriComponents; dark: UriComponents };
    return { light: URI.revive(icon.light), dark: URI.revive(icon.dark) };
  }
}

class MainThreadSCMHistoryProvider implements ISCMHistoryProvider {
  private _onDidChangeActionButton = new Emitter<void>();
  readonly onDidChangeActionButton = this._onDidChangeActionButton.event;

  private _onDidChangeCurrentHistoryItemGroup = new Emitter<void>();
  readonly onDidChangeCurrentHistoryItemGroup = this._onDidChangeCurrentHistoryItemGroup.event;

  private _actionButton: ISCMActionButtonDescriptor | undefined;
  get actionButton(): ISCMActionButtonDescriptor | undefined {
    return this._actionButton;
  }
  set actionButton(actionButton: ISCMActionButtonDescriptor | undefined) {
    this._actionButton = actionButton;
    this._onDidChangeActionButton.fire();
  }

  private _currentHistoryItemGroup: ISCMHistoryItemGroup | undefined;
  get currentHistoryItemGroup(): ISCMHistoryItemGroup | undefined {
    return this._currentHistoryItemGroup;
  }
  set currentHistoryItemGroup(historyItemGroup: ISCMHistoryItemGroup | undefined) {
    this._currentHistoryItemGroup = historyItemGroup;
    this._onDidChangeCurrentHistoryItemGroup.fire();
  }

  constructor(private readonly proxy: IExtHostSCMShape, private readonly handle: number) {}

  async resolveHistoryItemGroupBase(historyItemGroupId: string): Promise<ISCMHistoryItemGroup | undefined> {
    return this.proxy.$resolveHistoryItemGroupBase(this.handle, historyItemGroupId, CancellationToken.None);
  }

  async resolveHistoryItemGroupCommonAncestor(
    historyItemGroupId1: string,
    historyItemGroupId2: string,
  ): Promise<{ id: string; ahead: number; behind: number } | undefined> {
    return this.proxy.$resolveHistoryItemGroupCommonAncestor(
      this.handle,
      historyItemGroupId1,
      historyItemGroupId2,
      CancellationToken.None,
    );
  }

  async provideHistoryItems(
    historyItemGroupId: string,
    options: ISCMHistoryOptions,
  ): Promise<ISCMHistoryItem[] | undefined> {
    const historyItems = await this.proxy.$provideHistoryItems(
      this.handle,
      historyItemGroupId,
      options,
      CancellationToken.None,
    );
    return historyItems?.map((historyItem) => ({ ...historyItem, icon: getSCMHistoryItemIcon(historyItem) }));
  }

  async provideHistoryItemChanges(historyItemId: string): Promise<ISCMHistoryItemChange[] | undefined> {
    const changes = await this.proxy.$provideHistoryItemChanges(this.handle, historyItemId, CancellationToken.None);
    return changes?.map((change) => ({
      uri: URI.revive(change.uri),
      originalUri: change.originalUri && URI.revive(change.originalUri),
      modifiedUri: change.modifiedUri && URI.revive(change.modifiedUri),
      renameUri: change.renameUri && URI.revive(change.renameUri),
    }));
  }
}

class MainThreadSCMProvider implements ISCMProvider {
  private static ID_HANDLE = 0;
  private _id = `scm${MainThreadSCMProvider.ID_HANDLE++}`;
  get id(): string {
    return this._id;
  }

  readonly groups = new Sequence<MainThreadSCMResourceGroup>();
  private readonly _groupsByHandle: { [handle: number]: MainThreadSCMResourceGroup } = Object.create(null);

  private _onDidChangeResources = new Emitter<void>();
  readonly onDidChangeResources: Event<void> = this._onDidChangeResources.event;

  private features: SCMProviderFeatures = {};

  get handle(): number {
    return this._handle;
  }

  get label(): string {
    return this._label;
  }

  get rootUri(): URI | undefined {
    return this._rootUri;
  }

  get contextValue(): string {
    return this._contextValue;
  }

  get commitTemplate(): string | undefined {
    return this.features.commitTemplate;
  }

  get acceptInputCommand(): VSCommand | undefined {
    return this.features.acceptInputCommand;
  }

  get statusBarCommands(): VSCommand[] | undefined {
    return this.features.statusBarCommands;
  }

  get count(): number | undefined {
    return this.features.count;
  }

  get actionButton() {
    return this.features.actionButton;
  }

  get historyProvider(): ISCMHistoryProvider | undefined {
    return this._historyProvider;
  }

  private _historyProvider: ISCMHistoryProvider | undefined;

  private _onDidChangeCommitTemplate = new Emitter<string>();
  readonly onDidChangeCommitTemplate: Event<string> = this._onDidChangeCommitTemplate.event;

  private _onDidChangeStatusBarCommands = new Emitter<VSCommand[]>();
  get onDidChangeStatusBarCommands(): Event<VSCommand[]> {
    return this._onDidChangeStatusBarCommands.event;
  }

  private readonly _onDidChangeHistoryProvider = new Emitter<void>();
  readonly onDidChangeHistoryProvider: Event<void> = this._onDidChangeHistoryProvider.event;

  private _onDidChange = new Emitter<void>();
  readonly onDidChange: Event<void> = this._onDidChange.event;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  constructor(
    private readonly proxy: IExtHostSCMShape,
    private readonly _handle: number,
    private readonly _contextValue: string,
    private readonly _label: string,
    private readonly _rootUri: URI | undefined,
  ) {}

  $updateSourceControl(features: SCMProviderFeatures): void {
    this.features = Object.assign(this.features, features);
    this._onDidChange.fire();

    if (typeof features.commitTemplate !== 'undefined') {
      this._onDidChangeCommitTemplate.fire(this.commitTemplate!);
    }

    if (typeof features.statusBarCommands !== 'undefined') {
      this._onDidChangeStatusBarCommands.fire(this.statusBarCommands!);
    }

    if (features.hasHistoryProvider && !this._historyProvider) {
      this._historyProvider = new MainThreadSCMHistoryProvider(this.proxy, this.handle);
      this._onDidChangeHistoryProvider.fire();
    } else if (features.hasHistoryProvider === false && this._historyProvider) {
      this._historyProvider = undefined;
      this._onDidChangeHistoryProvider.fire();
    }
  }

  $registerGroup(handle: number, id: string, label: string): void {
    const group = new MainThreadSCMResourceGroup(this.handle, handle, this, {}, label, id);

    this._groupsByHandle[handle] = group;
    this.groups.splice(this.groups.elements.length, 0, [group]);
  }

  $updateGroup(handle: number, features: SCMGroupFeatures): void {
    const group = this._groupsByHandle[handle];

    if (!group) {
      return;
    }

    group.$updateGroup(features);
  }

  $updateGroupLabel(handle: number, label: string): void {
    const group = this._groupsByHandle[handle];

    if (!group) {
      return;
    }

    group.$updateGroupLabel(label);
  }

  $spliceGroupResourceStates(splices: SCMRawResourceSplices[]): void {
    for (const [groupHandle, groupSlices] of splices) {
      const group = this._groupsByHandle[groupHandle];

      if (!group) {
        this.logger.warn(`SCM group ${groupHandle} not found in provider ${this.label}`);
        continue;
      }

      // reverse the splices sequence in order to apply them correctly
      groupSlices.reverse();

      for (const [start, deleteCount, rawResources] of groupSlices) {
        const resources = rawResources.map((rawResource) => {
          const [handle, sourceUri, icons, tooltip, strikeThrough, faded, contextValue, command] = rawResource;
          const icon = icons[0];
          const iconDark = icons[1] || icon;
          const decorations = {
            icon: icon ? URI.parse(icon) : undefined,
            iconDark: iconDark ? URI.parse(iconDark) : undefined,
            tooltip,
            strikeThrough,
            faded,
          };

          return new MainThreadSCMResource(
            this.proxy,
            this.handle,
            groupHandle,
            handle,
            URI.revive(sourceUri),
            group,
            decorations,
            contextValue || undefined,
            command,
          );
        });

        group.splice(start, deleteCount, resources);
      }
    }

    this._onDidChangeResources.fire();
  }

  $unregisterGroup(handle: number): void {
    const group = this._groupsByHandle[handle];

    if (!group) {
      return;
    }

    delete this._groupsByHandle[handle];
    this.groups.splice(this.groups.elements.indexOf(group), 1);
    this._onDidChangeResources.fire();
  }

  $onDidChangeHistoryProviderActionButton(actionButton?: SCMActionButtonDto | null): void {
    if (!this._historyProvider) {
      return;
    }

    this._historyProvider.actionButton = actionButton ?? undefined;
  }

  $onDidChangeHistoryProviderCurrentHistoryItemGroup(currentHistoryItemGroup?: SCMHistoryItemGroupDto): void {
    if (!this._historyProvider) {
      return;
    }

    this._historyProvider.currentHistoryItemGroup = currentHistoryItemGroup ?? undefined;
  }

  async getOriginalResource(uri: URI): Promise<URI | null> {
    if (!this.features.hasQuickDiffProvider) {
      return null;
    }

    const result = await this.proxy.$provideOriginalResource(this.handle, uri, CancellationToken.None);
    return result && URI.revive(result);
  }

  toJSON() {
    return {
      $mid: 5,
      handle: this.handle,
    };
  }

  dispose(): void {}
}

@Injectable({ multiple: true })
export class MainThreadSCM extends Disposable implements IMainThreadSCMShape {
  @Autowired(SCMService)
  private readonly scmService: SCMService;

  private readonly _proxy: IExtHostSCMShape;
  private _repositories = new Map<number, ISCMRepository>();
  private _inputDisposables = new Map<number, IDisposable>();

  constructor(@Optional(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    super();
    this._proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostSCM);

    Event.debounce(this.scmService.onDidChangeSelectedRepositories, (_, e) => e, 100)(
      this.onDidChangeSelectedRepositories,
      this,
      this.disposables,
    );
  }

  dispose(): void {
    this._repositories.forEach((r) => r.dispose());
    this._repositories.clear();

    this._inputDisposables.forEach((d) => d.dispose());
    this._inputDisposables.clear();

    super.dispose();
  }

  $registerSourceControl(handle: number, id: string, label: string, rootUri: UriComponents | undefined): void {
    const provider = new MainThreadSCMProvider(this._proxy, handle, id, label, rootUri && URI.revive(rootUri));
    const repository = this.scmService.registerSCMProvider(provider);
    this._repositories.set(handle, repository);

    const inputDisposable = repository.input.onDidChange((value) => this._proxy.$onInputBoxValueChange(handle, value));
    this._inputDisposables.set(handle, inputDisposable);

    this.addDispose(
      Disposable.create(() => {
        this.$unregisterSourceControl(handle);
      }),
    );
  }

  $updateSourceControl(handle: number, features: SCMProviderFeatures): void {
    const repository = this._repositories.get(handle);

    if (!repository) {
      return;
    }

    const provider = repository.provider as MainThreadSCMProvider;
    provider.$updateSourceControl(features);
  }

  $unregisterSourceControl(handle: number): void {
    const repository = this._repositories.get(handle);

    if (!repository) {
      return;
    }

    this._inputDisposables.get(handle)!.dispose();
    this._inputDisposables.delete(handle);

    repository.dispose();
    this._repositories.delete(handle);
  }

  $registerGroup(sourceControlHandle: number, groupHandle: number, id: string, label: string): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    const provider = repository.provider as MainThreadSCMProvider;
    provider.$registerGroup(groupHandle, id, label);

    this.addDispose(
      Disposable.create(() => {
        provider.$unregisterGroup(groupHandle);
      }),
    );
  }

  $updateGroup(sourceControlHandle: number, groupHandle: number, features: SCMGroupFeatures): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    const provider = repository.provider as MainThreadSCMProvider;
    provider.$updateGroup(groupHandle, features);
  }

  $updateGroupLabel(sourceControlHandle: number, groupHandle: number, label: string): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    const provider = repository.provider as MainThreadSCMProvider;
    provider.$updateGroupLabel(groupHandle, label);
  }

  $spliceResourceStates(sourceControlHandle: number, splices: SCMRawResourceSplices[]): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    const provider = repository.provider as MainThreadSCMProvider;
    provider.$spliceGroupResourceStates(splices);
  }

  $unregisterGroup(sourceControlHandle: number, handle: number): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    const provider = repository.provider as MainThreadSCMProvider;
    provider.$unregisterGroup(handle);
  }

  $setInputBoxValue(sourceControlHandle: number, value: string): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    repository.input.value = value;
  }

  $setInputBoxPlaceholder(sourceControlHandle: number, placeholder: string): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    repository.input.placeholder = placeholder;
  }

  $setInputBoxEnablement(sourceControlHandle: number, enabled: boolean): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    repository.input.enabled = enabled;
  }

  $setInputBoxVisibility(sourceControlHandle: number, visible: boolean): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    repository.input.visible = visible;
  }

  $setValidationProviderIsEnabled(sourceControlHandle: number, enabled: boolean): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    if (enabled) {
      repository.input.validateInput = async (value, pos): Promise<IInputValidation | undefined> => {
        const result = await this._proxy.$validateInput(sourceControlHandle, value, pos);
        return result && { message: result[0], type: result[1] };
      };
    } else {
      repository.input.validateInput = async () => undefined;
    }
  }

  $onDidChangeHistoryProviderActionButton(
    sourceControlHandle: number,
    actionButton?: SCMActionButtonDto | null | undefined,
  ): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    const provider = repository.provider as MainThreadSCMProvider;
    provider.$onDidChangeHistoryProviderActionButton(actionButton);
  }

  $onDidChangeHistoryProviderCurrentHistoryItemGroup(
    sourceControlHandle: number,
    historyItemGroup: SCMHistoryItemGroupDto | undefined,
  ): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    const provider = repository.provider as MainThreadSCMProvider;
    provider.$onDidChangeHistoryProviderCurrentHistoryItemGroup(historyItemGroup);
  }

  $setInputBoxActionButton(
    sourceControlHandle: number,
    actionButton?: SCMInputActionButtonDto | null | undefined,
  ): void {
    const repository = this._repositories.get(sourceControlHandle);

    if (!repository) {
      return;
    }

    repository.input.actionButton = actionButton
      ? { ...actionButton, icon: getSCMInputBoxActionButtonIcon(actionButton) }
      : undefined;
  }

  private onDidChangeSelectedRepositories(repositories: ISCMRepository[]): void {
    const handles = repositories
      .filter((r) => r.provider instanceof MainThreadSCMProvider)
      .map((r) => (r.provider as MainThreadSCMProvider).handle);

    // 跟 SCM 插件进程通信
    this._proxy.$setSelectedSourceControls(handles);
  }
}

function getSCMInputBoxActionButtonIcon(
  actionButton: SCMInputActionButtonDto,
): URI | { light: URI; dark: URI } | vscode.ThemeIcon | undefined {
  if (!actionButton.icon) {
    return undefined;
  } else if (URI.isUri(actionButton.icon)) {
    return URI.revive(actionButton.icon);
  } else {
    const icon = actionButton.icon as { light: UriComponents; dark: UriComponents };
    return { light: URI.revive(icon.light), dark: URI.revive(icon.dark) };
  }
}
