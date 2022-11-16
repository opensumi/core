import { observable, action } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import {
  Disposable,
  fuzzyScore,
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
export class VSXExtensionService extends Disposable implements IVSXExtensionService {
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

  @observable
  public installedExtensions: VSXExtension[] = [];

  @observable
  public openVSXRegistry: string;

  @Autowired(IStatusBarService)
  protected readonly statusBarService: IStatusBarService;

  private installStatus?: StatusBarEntryAccessor;
  private searchValue: string;

  @observable
  private tasks: Map<string, Promise<string>> = new Map();

  constructor() {
    super();
    this.getInstalledExtensions();
    this.disposables.push(
      this.extensionInstanceService.onDidChange(() => {
        this.getInstalledExtensions();
        this.search(this.searchValue);
      }),
    );
  }

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
    const id = this.getExtensionId(extension);
    if (this.tasks.has(id) || !extension.downloadUrl) {
      return;
    }

    const task = this.backService.install({
      id,
      name: extension.name ?? '-',
      url: extension.downloadUrl,
      version: extension.version ?? '-',
    });
    this.tasks.set(id, task);
    this.updateStatusBar();
    return task.then((res) => {
      this.tasks.delete(id);
      this.updateStatusBar();
      this.extensionManagementService.postChangedExtension(false, res);
    });
  }

  async uninstall(extension: VSXExtension) {
    if (extension && extension.path) {
      await this.extensionManagementService.postUninstallExtension(extension.path);
    }
  }

  async disable(extension: VSXExtension) {
    if (extension && extension.path) {
      this.extensionManagementService.postDisableExtension(extension.path);
    }
  }

  async enable(extension: VSXExtension) {
    if (extension && extension.path) {
      this.extensionManagementService.postEnableExtension(extension.path);
    }
  }

  getExtensionId(extension: VSXExtension) {
    return extension?.extensionId ?? extension?.namespace?.toLowerCase() + '.' + extension?.name?.toLowerCase();
  }

  async getLocalExtension(extensionId: string): Promise<VSXExtension | undefined> {
    if (!extensionId) {
      return;
    }
    const extension = this.extensions.find((e) => this.getExtensionId(e) === extensionId);

    return extension || this.installedExtensions.find((e) => this.getExtensionId(e) === extensionId);
  }

  async getRemoteRawExtension(extensionId: string): Promise<VSXExtensionRaw | undefined> {
    if (!extensionId) {
      return;
    }
    const param: QueryParam = {
      extensionId,
    };
    const res = await this.backService.getExtension(param);
    if (res && res.extensions && res.extensions.length >= 1) {
      return Object.assign({}, res.extensions[0]);
    }
  }

  async getOpenVSXRegistry() {
    this.openVSXRegistry = await this.backService.getOpenVSXRegistry();
  }

  async openExtensionEditor(extensionId: string, state: InstallState) {
    this.workbenchEditorService.open(new URI(`extension://?extensionId=${extensionId}&state=${state}`), {
      preview: true,
    });
  }

  @action
  async search(keyword: string) {
    const param: VSXSearchParam = {
      query: keyword,
      size: 50,
      sortBy: 'downloadCount',
    };
    this.searchValue = keyword;

    const res = await this.backService.search(param);
    if (res.extensions) {
      this.extensions = res.extensions
        .filter((ext) => !this.installedExtensions.find((e) => this.getExtensionId(e) === this.getExtensionId(ext)))
        .map((ext) => ({
          ...ext,
          publisher: ext.namespace,
          iconUrl: ext.files.icon,
          downloadUrl: ext.files.download,
          readme: ext.files.readme,
        }));
    }
  }

  @action
  async searchInstalledExtensions(keyword: string) {
    this.installedExtensions = this.installedExtensions.sort((a, b) => {
      const scoreA = fuzzyScore(keyword, keyword.toLowerCase(), 0, a.name, a.name.toLowerCase(), 0, true);
      const scoreB = fuzzyScore(keyword, keyword.toLowerCase(), 0, b.name, b.name.toLowerCase(), 0, true);
      if (!scoreA) {
        return 1;
      }
      if (!scoreB) {
        return -1;
      }
      return scoreB[0] - scoreA[0];
    });
  }

  @action
  getInstalledExtensions() {
    this.installedExtensions = this.extensionInstanceService.getExtensionInstances().map((e) => {
      const extensionId = e.extensionId;
      const namespace = extensionId && extensionId.includes('.') ? extensionId.split('.')[0] : e.packageJSON.publisher;

      return {
        namespace,
        name: e.packageJSON.name,
        id: e.extensionId,
        version: e.packageJSON.version,
        displayName: e.packageJSON.displayName,
        description: e.packageJSON.description,
        publisher: e.packageJSON.publisher,
        iconUrl: e.packageJSON.icon && e.extensionLocation.toString() + `/${e.packageJSON.icon}`,
        path: e.path,
        realpath: e.realPath,
      };
    });
  }
}
