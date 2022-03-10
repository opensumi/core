import { observable, computed } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import {
  IStatusBarService,
  localize,
  StatusBarAlignment,
  StatusBarEntryAccessor,
  URI,
} from '@opensumi/ide-core-browser';
import { WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { ExtensionManagementService } from '@opensumi/ide-extension/lib/browser/extension-management.service';
import { AbstractExtInstanceManagementService } from '@opensumi/ide-extension/lib/browser/types';

import {
  InstallState,
  IVSXExtensionBackService,
  IVSXExtensionService,
  VSXExtension,
  VSXExtensionServicePath,
} from '../common';
import { VSXExtensionRaw, VSXSearchParam, QueryParam } from '../common/vsx-registry-types';

@Injectable()
export class VSXExtensionService implements IVSXExtensionService {
  @Autowired(VSXExtensionServicePath)
  private readonly backService: IVSXExtensionBackService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(AbstractExtInstanceManagementService)
  private readonly extensionInstanceService: AbstractExtInstanceManagementService;

  @Autowired()
  protected extensionManagementService: ExtensionManagementService;

  @observable
  public extensions: VSXExtension[] = [];

  @Autowired(IStatusBarService)
  protected readonly statusBarService: IStatusBarService;

  private installStatus?: StatusBarEntryAccessor;

  @observable
  private tasks: Map<string, Promise<string>> = new Map();

  private updateStatusBar() {
    if (this.tasks.size === 0) {
      if (this.installStatus) {
        this.installStatus.dispose();
        this.installStatus = undefined;
      }
      return;
    }

    const entryId = 'sumi-upload-file-status';
    if (this.tasks.size === 1) {
      const message = localize('marketplace.extension.installing');
      const entry = {
        text: message,
        alignment: StatusBarAlignment.RIGHT,
        tooltip: message,
        iconClass: 'kaitian-icon kticon-cloud-server',
      };
      this.installStatus = this.statusBarService.addElement(entryId, entry);
    }
  }

  async install(extension: VSXExtension): Promise<void> {
    const id = extension?.namespace?.toLowerCase() + '.' + extension?.name?.toLowerCase();
    if (this.tasks.has(id) || !extension.downloadUrl) {
      return;
    }

    const task = this.backService.install({
      id,
      name: extension.name!,
      url: extension.downloadUrl,
      version: extension.version!,
    });
    this.tasks.set(id, task);
    this.updateStatusBar();
    return task.then((res) => {
      this.tasks.delete(id);
      this.updateStatusBar();
      this.extensionManagementService.postChangedExtension(false, res);
    });
  }

  private asExtensionId(extension: VSXExtension) {
    return extension?.namespace?.toLowerCase() + '.' + extension?.name?.toLowerCase();
  }

  async getLocalExtension(extensionId: string): Promise<VSXExtension | undefined> {
    const extension = this.extensions.find((e) => this.asExtensionId(e) === extensionId);

    return extension || this.installedExtensions.find((e) => this.asExtensionId(e) === extensionId);
  }

  async getRemoteRawExtension(extensionId: string): Promise<VSXExtensionRaw | undefined> {
    const param: QueryParam = {
      extensionId,
    };
    const res = await this.backService.getExtension(param);
    if (res && res.extensions && res.extensions.length >= 1) {
      return Object.assign({}, res.extensions[0]);
    }
  }

  async openExtensionEditor(extensionId: string, state: InstallState) {
    this.workbenchEditorService.open(new URI(`extension://?extensionId=${extensionId}&state=${state}`), {
      preview: true,
    });
  }

  async search(keyword: string): Promise<void> {
    const param: VSXSearchParam = {
      query: keyword,
    };

    const res = await this.backService.search(param);
    if (res.extensions) {
      this.extensions = res.extensions.map((ext) => ({
        ...ext,
        publisher: ext.namespace,
        iconUrl: ext.files.icon,
        downloadUrl: ext.files.download,
        readme: ext.files.readme,
      }));
    }
  }

  @computed
  get installedExtensions(): VSXExtension[] {
    return this.extensionInstanceService.getExtensionInstances().map((e) => ({
      namespace: e.packageJSON.publisher,
      name: e.packageJSON.name,
      id: e.extensionId,
      version: e.packageJSON.version,
      displayName: e.packageJSON.displayName,
      description: e.packageJSON.description,
      publisher: e.packageJSON.publisher,
      iconUrl: e.packageJSON.icon && e.extensionLocation.toString() + `/${e.packageJSON.icon}`,
    }));
  }
}
