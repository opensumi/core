import { Injectable, Optional, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { ILogger } from '@opensumi/ide-core-browser';
import {
  UriComponents,
  Uri as URI,
  Event,
  Emitter,
  IDisposable,
  Disposable,
  CancellationToken,
} from '@opensumi/ide-core-common';
import { Sequence, ISplice } from '@opensumi/ide-core-common/lib/sequence';
import {
  ISCMRepository,
  ISCMProvider,
  ISCMResource,
  ISCMResourceGroup,
  ISCMResourceDecorations,
  IInputValidation,
  SCMService,
} from '@opensumi/ide-scm/lib/common';

import { ExtHostAPIIdentifier } from '../../../common/vscode';
import { VSCommand } from '../../../common/vscode/model.api';
import {
  IExtHostSCMShape,
  SCMProviderFeatures,
  SCMGroupFeatures,
  SCMRawResourceSplices,
  IMainThreadSCMShape,
} from '../../../common/vscode/scm';


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
    this.elements.splice(start, deleteCount, ...toInsert);
    this._onDidSplice.fire({ start, deleteCount, toInsert });
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

class MainThreadSCMProvider implements ISCMProvider {
  private static ID_HANDLE = 0;
  private _id = `scm${MainThreadSCMProvider.ID_HANDLE++}`;
  get id(): string {
    return this._id;
  }

  readonly groups = new Sequence<MainThreadSCMResourceGroup>();
  private readonly _groupsByHandle: { [handle: number]: MainThreadSCMResourceGroup } = Object.create(null);

  // get groups(): ISequence<ISCMResourceGroup> {
  // 	return {
  // 		elements: this._groups,
  // 		onDidSplice: this._onDidSplice.event
  // 	};

  // 	// return this._groups
  // 	// 	.filter(g => g.resources.elements.length > 0 || !g.features.hideWhenEmpty);
  // }

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

  private _onDidChangeCommitTemplate = new Emitter<string>();
  readonly onDidChangeCommitTemplate: Event<string> = this._onDidChangeCommitTemplate.event;

  private _onDidChangeStatusBarCommands = new Emitter<VSCommand[]>();
  get onDidChangeStatusBarCommands(): Event<VSCommand[]> {
    return this._onDidChangeStatusBarCommands.event;
  }

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
          const [
            handle,
            sourceUri,
            icons,
            tooltip,
            strikeThrough,
            faded,
            contextValue,
            command,
            source,
            letter,
            color,
          ] = rawResource;
          const icon = icons[0];
          const iconDark = icons[1] || icon;
          const decorations = {
            icon: icon ? URI.parse(icon) : undefined,
            iconDark: iconDark ? URI.parse(iconDark) : undefined,
            tooltip,
            strikeThrough,
            faded,
            source,
            letter,
            color: color ? color.id : undefined,
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

  private onDidChangeSelectedRepositories(repositories: ISCMRepository[]): void {
    const handles = repositories
      .filter((r) => r.provider instanceof MainThreadSCMProvider)
      .map((r) => (r.provider as MainThreadSCMProvider).handle);

    // 跟 SCM 插件进程通信
    this._proxy.$setSelectedSourceControls(handles);
  }
}
